import React, { useState, useEffect } from 'react';
import { X, Layers, Plus, CheckCircle, Calendar, AlertCircle, Search, Trash2, Package, Tag, ArrowRight, Loader2, Sparkles, Factory, Printer } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const ManageLotModal = ({ isOpen, onClose, selectedItems = [], preselectedLotCode = null, onSuccess, onReleaseImmediately }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState(preselectedLotCode ? 'existing' : 'new'); // 'new' | 'existing'
    const [customCode, setCustomCode] = useState('');
    const [lotDate, setLotDate] = useState('');
    const [lotNotes, setLotNotes] = useState('');
    const [existingLots, setExistingLots] = useState([]);
    const [selectedExistingLot, setSelectedExistingLot] = useState(preselectedLotCode || '');
    const [searchLotTerm, setSearchLotTerm] = useState('');
    const [itemsList, setItemsList] = useState([]);
    const [loadingLots, setLoadingLots] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Initial setup on open
    useEffect(() => {
        if (isOpen) {
            setItemsList([...selectedItems]);
            setMode(preselectedLotCode ? 'existing' : 'new');
            setCustomCode('');
            setLotNotes('');
            setSelectedExistingLot(preselectedLotCode || '');
            
            // Set default date to earliest or latest date among items
            const dates = selectedItems.map(i => i.data_entrega_pcp || i.pcp_delivery_forecast_date).filter(Boolean);
            if (dates.length > 0) {
                const d = new Date(dates[0]);
                if (!isNaN(d.getTime())) {
                    setLotDate(d.toISOString().split('T')[0]);
                }
            } else {
                setLotDate(new Date().toISOString().split('T')[0]);
            }

            fetchActiveLots();
        }
    }, [isOpen, selectedItems, preselectedLotCode]);

    const fetchActiveLots = async () => {
        try {
            setLoadingLots(true);
            const res = await api.get('/pcp-releases/active-lots');
            if (Array.isArray(res.data)) {
                setExistingLots(res.data);
                if (res.data.length > 0 && !selectedExistingLot && !preselectedLotCode) {
                    setSelectedExistingLot(res.data[0].codigo);
                }
            }
        } catch (err) {
            console.error('Erro ao buscar lotes ativos:', err);
        } finally {
            setLoadingLots(false);
        }
    };

    if (!isOpen) return null;

    const handleRemoveItem = (index) => {
        setItemsList(prev => prev.filter((_, i) => i !== index));
    };

    const totalPecas = itemsList.reduce((acc, i) => acc + (parseFloat(i.visual_qtd || i.quantidade_pcp || i.qtd_faturar || 0)), 0);

    const handleSave = async (shouldRelease = false) => {
        if (itemsList.length === 0) {
            toast.warning('Nenhum item selecionado para incluir no lote.');
            return;
        }

        let targetCode = null;
        if (mode === 'new') {
            targetCode = customCode.trim() ? customCode.trim().toUpperCase() : null;
            const blocked = itemsList.filter(it => it.lpf_codigo);
            if (blocked.length > 0) {
                toast.warning(`${blocked.length} item(ns) já pertencem a outro lote (${blocked.map(b => b.lpf_codigo).slice(0, 2).join(', ')}). Remova-os do lote atual antes.`);
                return;
            }
        } else {
            if (!selectedExistingLot) {
                toast.warning('Selecione um lote existente da lista.');
                return;
            }
            targetCode = selectedExistingLot;
            const foreign = itemsList.filter(it => it.lpf_codigo && it.lpf_codigo !== targetCode);
            if (foreign.length > 0) {
                toast.warning(`${foreign.length} item(ns) já pertencem a outro lote (${foreign[0].lpf_codigo}). Remova-os primeiro.`);
                return;
            }
        }

        try {
            setSubmitting(true);

            const payloadItems = itemsList.map(item => ({
                pedido: item.pedido,
                item: item.item,
                visual_op: item.visual_op || item.op_num || item.numero_lote || `${item.pedido}-${item.item}`,
                codigo: item.codigo || item.produto || '',
                desc_produto: item.descricao || item.desc_produto || '',
                visual_qtd: item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0,
                nome_cliente: item.nome_cliente || item.cliente || '',
                entrega: item.entrega || lotDate || null,
                fraction_id: item.fraction_id,
                is_fraction: !!item.is_fraction,
                fraction_letter: item.fraction_letter || item.numero_lote || '',
                quantidade_pcp: item.visual_qtd || item.quantidade_pcp || item.qtd_faturar,
                data_entrega_pcp: lotDate || null
            }));

            const response = await api.post('/pcp-releases/create-or-assign-lot', {
                codigo_lote: targetCode,
                data_pcp: lotDate || null,
                items: payloadItems,
                usuario: user?.nome || 'PCP Gestão',
                observacao: lotNotes || null
            });

            const codeCreated = response.data?.codigo_lote || targetCode;
            toast.success(`Itens agrupados com sucesso no Lote de Fabricação ${codeCreated}!`);

            if (shouldRelease && onReleaseImmediately) {
                onReleaseImmediately(codeCreated, itemsList);
            }

            if (onSuccess) onSuccess(codeCreated);
            onClose();
        } catch (err) {
            console.error('Erro ao vincular ao lote:', err);
            toast.error(err.response?.data?.error || 'Falha ao salvar lote de fabricação.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredLots = existingLots.filter(l => 
        l.codigo.toLowerCase().includes(searchLotTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 animate-scaleUp">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600/30 border border-emerald-400/40 rounded-xl">
                            <Layers className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Lote de Fabricação (LPF) / Aglutinação</h2>
                            <p className="text-xs text-slate-300">
                                Criação e agrupamento de OPs para planejamento e liberação de produção
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    
                    {/* Tabs / Mode Selector */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setMode('new')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                mode === 'new'
                                    ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Plus className="w-4 h-4 text-emerald-600" />
                            Novo Lote (Numeração Automática)
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('existing')}
                            className={`py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                mode === 'existing'
                                    ? 'bg-white text-blue-800 shadow-sm border border-blue-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Package className="w-4 h-4 text-blue-600" />
                            Adicionar a Lote Existente ({existingLots.length})
                        </button>
                    </div>

                    {/* Mode New Fields */}
                    {mode === 'new' ? (
                        <div className="space-y-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-emerald-950">Código Oficial do Lote</span>
                                        <p className="text-[11px] text-emerald-700 font-medium">
                                            Gerado automaticamente em sequência única: <strong>LPF-2026-0000X</strong>
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono">
                                    AUTOMÁTICO
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Data Prevista Fabricação (PCP):
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <input
                                            type="date"
                                            value={lotDate}
                                            onChange={(e) => setLotDate(e.target.value)}
                                            className="pl-9 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Observações / Instruções do Lote:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Prioridade cliente, liberação parcial..."
                                        value={lotNotes}
                                        onChange={(e) => setLotNotes(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Mode Existing Fields */
                        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <label className="block text-xs font-bold text-slate-700">
                                Selecione o Lote de Destino:
                            </label>

                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filtrar código do lote..."
                                    value={searchLotTerm}
                                    onChange={(e) => setSearchLotTerm(e.target.value)}
                                    className="pl-9 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {loadingLots ? (
                                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    Carregando lotes ativos...
                                </div>
                            ) : filteredLots.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-slate-100">
                                    Nenhum lote ativo encontrado. Crie um novo lote na aba ao lado.
                                </div>
                            ) : (
                                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                    {filteredLots.map(l => {
                                        const isSelected = selectedExistingLot === l.codigo;
                                        return (
                                            <div
                                                key={l.codigo}
                                                onClick={() => setSelectedExistingLot(l.codigo)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                        <Tag className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <span className="font-mono font-bold text-xs text-slate-900">{l.codigo}</span>
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                            <span>{l.qtd_itens} item(ns)</span>
                                                            {l.total_pecas > 0 && <span>• {l.total_pecas.toLocaleString('pt-BR')} peças</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    {l.release?.status === 'LIBERADO' ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            Liberado
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                            Em Montagem
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selected Items List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-emerald-600" />
                                Itens Selecionados para o Lote ({itemsList.length})
                            </span>
                            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                Total: {totalPecas.toLocaleString('pt-BR')} peças
                            </span>
                        </div>

                        {itemsList.length === 0 ? (
                            <div className="p-6 text-center text-xs text-amber-600 bg-amber-50 rounded-xl border border-amber-200">
                                Nenhum item selecionado. Feche e selecione itens na tabela.
                            </div>
                        ) : (
                            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs max-h-48 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-600 border-b border-gray-200 uppercase text-[10px]">
                                        <tr>
                                            <th className="py-2 px-3">Pedido</th>
                                            <th className="py-2 px-3">OP / Fração</th>
                                            <th className="py-2 px-3">Cód. Produto</th>
                                            <th className="py-2 px-3">Descrição</th>
                                            <th className="py-2 px-3 text-right">Qtd. a Fabricar</th>
                                            <th className="py-2 px-3 text-center w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {itemsList.map((item, idx) => (
                                            <tr key={`${item.pedido}-${item.item}-${idx}`} className="hover:bg-slate-50">
                                                <td className="py-2 px-3 font-bold text-slate-800">{item.pedido}</td>
                                                <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                                                    {item.visual_op || item.op_num || '-'}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-slate-600">
                                                    {item.codigo || item.produto || '-'}
                                                </td>
                                                <td className="py-2 px-3 text-slate-700 truncate max-w-[180px]" title={item.descricao || item.desc_produto}>
                                                    {item.descricao || item.desc_produto || '-'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-emerald-800">
                                                    {parseFloat(item.visual_qtd || item.quantidade_pcp || item.qtd_faturar || 0).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                                                        title="Remover item da lista"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-gray-100 flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={submitting || itemsList.length === 0}
                            className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    Salvar / Aglutinar Lote
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ManageLotModal;
