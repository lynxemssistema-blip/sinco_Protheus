import React, { useState, useEffect } from 'react';
import { api, createFaturamentoSolicitacao } from '../../services/api';
import { toast } from 'react-toastify';
import { Loader2, Printer, Check, User, Calendar, Trash2, Edit, X, FileText, CheckCircle2, AlertCircle, CheckSquare, Square, Layers, FolderInput, FilePlus2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LabelPrintModal from './LabelPrintModal';

export default function PreEtiquetasPendentes() {
    const { user } = useAuth();
    const [pendentes, setPendentes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Multi-seleção
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Label Modal State
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [itemsForLabel, setItemsForLabel] = useState([]);

    // Execution / Edit State
    const [editingId, setEditingId] = useState(null);
    const [editQty, setEditQty] = useState('');

    // Faturar Modal State
    const [faturarModalItems, setFaturarModalItems] = useState([]); // array de itens a faturar
    const [openSolicitacoes, setOpenSolicitacoes] = useState([]);
    const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);
    const [faturarTargetMode, setFaturarTargetMode] = useState('existing'); // 'existing' | 'new'
    const [selectedSolicitacaoId, setSelectedSolicitacaoId] = useState('');
    const [executarApontamento, setExecutarApontamento] = useState(true);
    const [isSubmittingFaturamento, setIsSubmittingFaturamento] = useState(false);

    const loadPendentes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/faturamento/pre-etiquetas/pendentes');
            setPendentes(res.data);
            // Limpa seleções de itens que não existem mais
            setSelectedIds(prev => {
                const next = new Set();
                const currentIds = new Set((res.data || []).map(p => p.id));
                prev.forEach(id => {
                    if (currentIds.has(id)) next.add(id);
                });
                return next;
            });
        } catch (err) {
            console.error("Erro ao carregar pendentes:", err);
            toast.error("Erro ao carregar pré-listas pendentes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPendentes();
    }, []);

    // Toggle seleção individual
    const toggleSelectItem = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Toggle selecionar todos
    const toggleSelectAll = () => {
        if (selectedIds.size === pendentes.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(pendentes.map(p => p.id)));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente cancelar esta pré-lista?")) return;
        try {
            await api.delete(`/faturamento/pre-etiquetas/${id}`);
            toast.success("Pré-lista cancelada.");
            loadPendentes();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao cancelar.");
        }
    };

    // Formatar item para o formato esperado pelo LabelPrintModal
    const formatItemForLabel = (item) => ({
        ...item,
        codigo: item.produto_codigo,
        descricao: item.produto_descricao,
        cliente: item.cliente || item.nome_cliente || '',
        nome_cliente: item.nome_cliente || item.cliente || '',
        cod_cliente: item.cod_cliente || item.cliente_cod || '',
        ped_cliente: item.ped_cliente || '',
        ref_cliente: item.ref_cliente || '',
        revisao: item.revisao || '',
        op_num_completa: item.op_num || '',
        cartQty: item.quantidade_solicitada,
        _pcp_prog: {
            id: item.pcp_forecast_id,
            data_entrega_pcp: item.pcp_data_entrega,
            serie_cliente: item.pcp_serie_cliente,
            serie_lynx: item.pcp_serie_lynx || item.pcp_serie_metalfisa,
            serie_metalfisa: item.pcp_serie_lynx || item.pcp_serie_metalfisa,
            numero_serie: item.pcp_numero_serie,
            lote: item.pcp_lote,
            numero_lote: item.pcp_numero_lote,
        }
    });

    // Impressão individual
    const handlePrintSingle = (item) => {
        setItemsForLabel([formatItemForLabel(item)]);
        setShowLabelModal(true);
    };

    // Impressão em lote
    const handlePrintBatch = () => {
        const selectedList = pendentes.filter(p => selectedIds.has(p.id));
        if (selectedList.length === 0) {
            return toast.warning("Selecione pelo menos uma etiqueta para imprimir.");
        }
        setItemsForLabel(selectedList.map(formatItemForLabel));
        setShowLabelModal(true);
    };

    const handleLabelPrinted = async () => {
        setShowLabelModal(false);
        toast.info("Etiqueta(s) enviada(s) / impressa(s).");
    };

    const handleSaveEdit = async (id) => {
        const val = parseFloat(editQty);
        if (isNaN(val) || val <= 0) return toast.error("Quantidade inválida.");
        
        try {
            await api.put(`/faturamento/pre-etiquetas/${id}`, { quantidade_solicitada: val });
            toast.success("Quantidade atualizada!");
            setEditingId(null);
            loadPendentes();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao atualizar.");
        }
    };

    // Abrir Modal de Faturamento (individual ou lote)
    const handleOpenFaturar = async (itemsToBill) => {
        const list = Array.isArray(itemsToBill) ? itemsToBill : [itemsToBill];
        if (list.length === 0) {
            return toast.warning("Nenhum item selecionado para faturar.");
        }

        setFaturarModalItems(list);
        setExecutarApontamento(list.some(it => Boolean(it.op_num)));
        setLoadingSolicitacoes(true);
        setSelectedSolicitacaoId('');
        
        try {
            const res = await api.get('/faturamento/solicitacoes', {
                params: { status: 'Pendente', limit: 50 }
            });
            const openList = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setOpenSolicitacoes(openList);
            
            if (openList.length > 0) {
                setFaturarTargetMode('existing');
                setSelectedSolicitacaoId(String(openList[0].id));
            } else {
                setFaturarTargetMode('new');
            }
        } catch (err) {
            console.error("Erro ao carregar solicitações em aberto:", err);
            setOpenSolicitacoes([]);
            setFaturarTargetMode('new');
        } finally {
            setLoadingSolicitacoes(false);
        }
    };

    // Faturar itens selecionados via checkbox
    const handleFaturarBatch = () => {
        const selectedList = pendentes.filter(p => selectedIds.has(p.id));
        if (selectedList.length === 0) {
            return toast.warning("Selecione pelo menos um item para faturar.");
        }
        handleOpenFaturar(selectedList);
    };

    // Confirmar Faturamento (suporta 1 ou N itens)
    const handleConfirmFaturamento = async () => {
        if (!faturarModalItems || faturarModalItems.length === 0) return;
        setIsSubmittingFaturamento(true);

        try {
            if (faturarTargetMode === 'existing') {
                if (!selectedSolicitacaoId) {
                    toast.warning("Selecione uma solicitação em aberto.");
                    setIsSubmittingFaturamento(false);
                    return;
                }

                // Inserir cada item selecionado na solicitação existente
                for (const it of faturarModalItems) {
                    await api.post(`/faturamento/solicitacoes/${selectedSolicitacaoId}/itens`, {
                        pedido: it.pedido,
                        item: it.item,
                        codigo_produto: it.produto_codigo,
                        quantidade_solicitada: parseFloat(it.quantidade_solicitada),
                        saldo_faturar_momentaneo: parseFloat(it.quantidade_solicitada),
                        ped_cliente: it.ped_cliente || null,
                        ref_cliente: it.ref_cliente || null,
                        nome_cliente: it.nome_cliente || it.cliente || null,
                        executar_apontamento: executarApontamento && Boolean(it.op_num),
                        quantidade_apontamento: (executarApontamento && it.op_num) ? parseFloat(it.quantidade_solicitada) : null,
                        pcp_forecast_id: it.pcp_forecast_id || null,
                        pcp_data_entrega: it.pcp_data_entrega || null,
                        pcp_serie_cliente: it.pcp_serie_cliente || null,
                        pcp_serie_lynx: it.pcp_serie_lynx || it.pcp_serie_metalfisa || null,
                        pcp_serie_metalfisa: it.pcp_serie_lynx || it.pcp_serie_metalfisa || null,
                        pcp_numero_serie: it.pcp_numero_serie || null,
                        pcp_lote: it.pcp_lote || null,
                        pcp_numero_lote: it.pcp_numero_lote || null,
                        usuario: user?.NomeCompleto || user?.nome || 'Operador'
                    });

                    // Marca como executado na pré-lista
                    await api.put(`/faturamento/pre-etiquetas/${it.id}/impresso`);
                }
                
                const solObj = openSolicitacoes.find(s => String(s.id) === String(selectedSolicitacaoId));
                toast.success(`${faturarModalItems.length} item(ns) inserido(s) na solicitação ${solObj?.numero_solicitacao || ''} com sucesso!`);
            } else {
                // Criar nova solicitação agrupando todos os itens selecionados
                const itemsToSubmit = faturarModalItems.map(it => ({
                    pedido: it.pedido,
                    item: it.item,
                    codigo: it.produto_codigo,
                    descricao: it.produto_descricao,
                    op_num_completa: it.op_num,
                    quantidade_solicitada: parseFloat(it.quantidade_solicitada),
                    saldo_faturar_momentaneo: parseFloat(it.quantidade_solicitada),
                    pedido_cliente: it.ped_cliente,
                    desenho_cliente: it.ref_cliente,
                    nome_cliente: it.nome_cliente || it.cliente,
                    executar_apontamento: executarApontamento && Boolean(it.op_num),
                    quantidade_apontamento: (executarApontamento && it.op_num) ? parseFloat(it.quantidade_solicitada) : null,
                    pcp_forecast_id: it.pcp_forecast_id,
                    pcp_data_entrega: it.pcp_data_entrega,
                    pcp_serie_cliente: it.pcp_serie_cliente,
                    pcp_serie_lynx: it.pcp_serie_lynx || it.pcp_serie_metalfisa || null,
                    pcp_serie_metalfisa: it.pcp_serie_lynx || it.pcp_serie_metalfisa || null,
                    pcp_numero_serie: it.pcp_numero_serie,
                    pcp_lote: it.pcp_lote,
                    pcp_numero_lote: it.pcp_numero_lote
                }));

                const resNew = await createFaturamentoSolicitacao({
                    usuario: user?.NomeCompleto || user?.nome || 'Sistema',
                    observacao: `Gerado via Pré-Lista de Etiqueta (${faturarModalItems.length} itens)`,
                    items: itemsToSubmit
                });

                // Marca todos como executados na pré-lista
                for (const it of faturarModalItems) {
                    await api.put(`/faturamento/pre-etiquetas/${it.id}/impresso`);
                }
                
                toast.success(`Nova solicitação ${resNew.data?.numero_solicitacao || ''} criada com sucesso (${faturarModalItems.length} itens)!`);
            }

            // Limpa seleções processadas
            const billedIds = new Set(faturarModalItems.map(i => i.id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                billedIds.forEach(id => next.delete(id));
                return next;
            });

            setFaturarModalItems([]);
            loadPendentes();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao processar faturamento.");
        } finally {
            setIsSubmittingFaturamento(false);
        }
    };

    const ActionButtons = ({ p }) => (
        <div className="flex items-center gap-1.5 justify-end">
            <button
                onClick={() => handlePrintSingle(p)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs transition-colors"
                title="Imprimir Etiqueta Individual"
            >
                <Printer size={14} /> <span>Imprimir</span>
            </button>
            <button
                onClick={() => handleOpenFaturar([p])}
                disabled={editingId === p.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 shadow-sm"
                title="Faturar este item"
            >
                <Check size={14} />
                <span>Faturar</span>
            </button>
            <button
                onClick={() => handleDelete(p.id)}
                className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors"
                title="Cancelar Pré-Lista"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );

    const QtyField = ({ p }) => (
        editingId === p.id ? (
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    inputMode="numeric"
                    value={editQty}
                    onChange={e => setEditQty(e.target.value)}
                    className="w-20 border border-slate-300 rounded p-1 text-center font-bold text-xs"
                    autoFocus
                />
                <button onClick={() => handleSaveEdit(p.id)} className="bg-emerald-100 text-emerald-700 p-1 rounded hover:bg-emerald-200">
                    <Check size={13} />
                </button>
                <button onClick={() => setEditingId(null)} className="bg-slate-100 text-slate-600 p-1 rounded hover:bg-slate-200">
                    <X size={13} />
                </button>
            </div>
        ) : (
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-slate-800">{p.quantidade_solicitada} un</span>
                <button
                    onClick={() => { setEditingId(p.id); setEditQty(p.quantidade_solicitada); }}
                    className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"
                    title="Editar Quantidade"
                >
                    <Edit size={13} />
                </button>
            </div>
        )
    );

    const isAllSelected = pendentes.length > 0 && selectedIds.size === pendentes.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < pendentes.length;

    return (
        <div className="p-3 sm:p-5 space-y-4 sm:space-y-6 h-full overflow-y-auto w-full pb-40">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm gap-3 shrink-0">
                <div>
                    <h2 className="text-lg sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                        <FileText className="text-indigo-600" size={24} />
                        Pré-Listas Pendentes
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                        Itens separados fisicamente na expedição. Selecione um ou mais itens para imprimir ou faturar em lote.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button 
                        onClick={loadPendentes} 
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 text-xs transition-colors shrink-0 shadow-sm"
                    >
                        Atualizar Lista
                    </button>
                </div>
            </div>

            {/* Barra de Ações em Lote (Sticky/Destaque) quando houver seleção */}
            {selectedIds.size > 0 && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in border border-indigo-500/30">
                    <div className="flex items-center gap-2.5">
                        <span className="bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
                            {selectedIds.size}
                        </span>
                        <span className="text-xs sm:text-sm font-bold">
                            {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
                        </span>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-xs text-slate-300 hover:text-white underline ml-1"
                        >
                            Desmarcar todos
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrintBatch}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 text-xs transition-all shadow-sm"
                        >
                            <Printer size={15} />
                            <span>Imprimir Selecionadas ({selectedIds.size})</span>
                        </button>

                        <button
                            onClick={handleFaturarBatch}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 text-xs transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Check size={16} />
                            <span>Faturar Selecionadas ({selectedIds.size})</span>
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center p-16 gap-3">
                    <Loader2 className="animate-spin text-indigo-500" size={40} />
                    <p className="text-xs font-bold text-slate-400">Carregando itens pendentes...</p>
                </div>
            ) : pendentes.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <Check className="mx-auto text-emerald-400 mb-3" size={48} />
                    <h3 className="text-xl font-bold text-slate-700">Tudo em dia!</h3>
                    <p className="text-slate-500 text-sm mt-1">Não há nenhuma pré-lista aguardando impressão ou faturamento no momento.</p>
                </div>
            ) : (
                <>
                    {/* Visualização Mobile: Cards Detalhados com Checkbox */}
                    <div className="flex flex-col gap-3 sm:hidden">
                        <div className="flex items-center justify-between px-1">
                            <button
                                onClick={toggleSelectAll}
                                className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
                            >
                                {isAllSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-slate-400" />}
                                <span>{isAllSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}</span>
                            </button>
                            <span className="text-xs font-bold text-slate-400">{pendentes.length} itens</span>
                        </div>

                        {pendentes.map(p => {
                            const isChecked = selectedIds.has(p.id);
                            return (
                                <div 
                                    key={p.id} 
                                    className={`bg-white rounded-2xl border-2 transition-all p-4 space-y-3 ${
                                        isChecked ? 'border-indigo-500 shadow-md bg-indigo-50/20' : 'border-slate-200 shadow-sm'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-start gap-2.5">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleSelectItem(p.id)}
                                                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <User size={13} className="text-slate-400" />
                                                    <span className="font-bold text-slate-800 text-xs">{p.criado_por}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                                    <Calendar size={11} />
                                                    <span>{new Date(p.criado_em).toLocaleString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1">
                                                <span className="bg-slate-800 text-white text-[11px] font-black px-2 py-0.5 rounded">PED {p.pedido}</span>
                                                <span className="bg-slate-200 text-slate-700 text-[11px] font-black px-1.5 py-0.5 rounded">IT {p.item}</span>
                                            </div>
                                            {p.op_num && <span className="text-[10px] text-slate-500 font-mono">OP: {p.op_num}</span>}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="font-black text-indigo-700 text-sm">{p.produto_codigo}</span>
                                            {p.revisao && (
                                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                                                    Rev: {p.revisao}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-semibold text-slate-700 line-clamp-2">{p.produto_descricao}</div>
                                        
                                        <div className="pt-1.5 border-t border-slate-200/60 text-xs space-y-0.5">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-slate-500 font-bold">Cliente:</span>
                                                <span className="font-extrabold text-slate-800 truncate max-w-[200px]" title={p.cliente || p.nome_cliente}>
                                                    {p.cliente || p.nome_cliente || '-'}
                                                </span>
                                            </div>
                                            {p.ped_cliente && (
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-500 font-bold">Ped. Cliente:</span>
                                                    <span className="font-mono font-bold text-slate-800">{p.ped_cliente}</span>
                                                </div>
                                            )}
                                            {p.ref_cliente && (
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-500 font-bold">Ref / Cód. Cliente:</span>
                                                    <span className="font-mono font-bold text-slate-800 truncate max-w-[180px]">{p.ref_cliente}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                                        <QtyField p={p} />
                                        <ActionButtons p={p} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Visualização Tablet / Desktop: Tabela Completa e Detalhada com Checkbox */}
                    <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="p-3.5 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={input => {
                                                if (input) input.indeterminate = isSomeSelected;
                                            }}
                                            onChange={toggleSelectAll}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            title="Selecionar / Desmarcar todos"
                                        />
                                    </th>
                                    <th className="p-3.5">Origem / Data</th>
                                    <th className="p-3.5">Pedido / Item / OP</th>
                                    <th className="p-3.5">Cliente</th>
                                    <th className="p-3.5">Produto / Detalhes</th>
                                    <th className="p-3.5">Qtd Solicitada</th>
                                    <th className="p-3.5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendentes.map(p => {
                                    const isChecked = selectedIds.has(p.id);
                                    return (
                                        <tr 
                                            key={p.id} 
                                            className={`transition-colors ${isChecked ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50/80'}`}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-3.5 align-middle text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleSelectItem(p.id)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                            </td>

                                            {/* Origem */}
                                            <td className="p-3.5 align-top">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                    <User size={13} className="text-slate-400" />
                                                    <span>{p.criado_por}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                                                    <Calendar size={11} />
                                                    <span>{new Date(p.criado_em).toLocaleString('pt-BR')}</span>
                                                </div>
                                            </td>

                                            {/* Pedido / Item / OP */}
                                            <td className="p-3.5 align-top">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="bg-slate-800 text-white font-black px-2 py-0.5 rounded text-xs shadow-sm">
                                                        PED: {p.pedido}
                                                    </span>
                                                    <span className="bg-slate-200 text-slate-800 font-black px-1.5 py-0.5 rounded text-xs">
                                                        IT: {p.item}
                                                    </span>
                                                </div>
                                                {p.op_num && (
                                                    <span className="text-[11px] font-mono text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60 inline-block">
                                                        OP: {p.op_num}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Cliente */}
                                            <td className="p-3.5 align-top max-w-[220px]">
                                                <div className="font-extrabold text-slate-800 text-xs truncate" title={p.cliente || p.nome_cliente}>
                                                    {p.cliente || p.nome_cliente || '-'}
                                                </div>
                                                {(p.cod_cliente || p.cliente_cod) && (
                                                    <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                                        Cód: {String(p.cod_cliente || p.cliente_cod).trim()}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Produto e Referências */}
                                            <td className="p-3.5 align-top max-w-[280px]">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="font-black text-indigo-700 text-xs">{p.produto_codigo}</span>
                                                    {p.revisao && (
                                                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                                                            Rev: {p.revisao}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-600 line-clamp-1 mb-1 font-medium" title={p.produto_descricao}>
                                                    {p.produto_descricao}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                    {p.ped_cliente && (
                                                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-bold" title="Pedido do Cliente">
                                                            PC: {p.ped_cliente}
                                                        </span>
                                                    )}
                                                    {p.ref_cliente && (
                                                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded font-mono font-bold truncate max-w-[160px]" title={`Cód. Produto Cliente: ${p.ref_cliente}`}>
                                                            Ref: {p.ref_cliente}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Quantidade */}
                                            <td className="p-3.5 align-top">
                                                <QtyField p={p} />
                                            </td>

                                            {/* Ações */}
                                            <td className="p-3.5 align-top text-right">
                                                <ActionButtons p={p} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Modal de Impressão de Etiquetas (Suporta individual e lote) */}
            {showLabelModal && itemsForLabel.length > 0 && (
                <LabelPrintModal
                    items={itemsForLabel}
                    onClose={handleLabelPrinted}
                />
            )}

            {/* Modal para Faturar (Individual ou Lote - Permite Escolher Opção 1 ou Opção 2) */}
            {faturarModalItems.length > 0 && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
                        {/* Header Modal */}
                        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <FileText className="text-emerald-400" size={22} />
                                <div>
                                    <h3 className="font-extrabold text-base sm:text-lg">
                                        Faturar {faturarModalItems.length === 1 ? 'Item de Pré-Lista' : `${faturarModalItems.length} Itens em Lote`}
                                    </h3>
                                    <p className="text-xs text-slate-300">Escolha como deseja direcionar o faturamento</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setFaturarModalItems([])} 
                                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Conteúdo com scroll */}
                        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Card de Resumo dos Itens Selecionados */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <span className="font-black text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <Layers size={14} className="text-indigo-600" />
                                        {faturarModalItems.length === 1 ? 'Item a ser Faturado' : `${faturarModalItems.length} Itens Selecionados`}
                                    </span>
                                    <span className="font-black text-indigo-700 text-xs">
                                        Total: {faturarModalItems.reduce((acc, it) => acc + (parseFloat(it.quantidade_solicitada) || 0), 0)} un
                                    </span>
                                </div>

                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                                    {faturarModalItems.map((item, idx) => (
                                        <div key={item.id || idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-800">{item.produto_codigo}</span>
                                                    <span className="bg-slate-200 text-slate-700 px-1 py-0.2 rounded text-[10px] font-bold">
                                                        Ped {item.pedido} - It {item.item}
                                                    </span>
                                                    {item.op_num && (
                                                        <span className="text-[10px] font-mono text-slate-500">
                                                            OP: {item.op_num}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate" title={item.cliente || item.nome_cliente}>
                                                    {item.cliente || item.nome_cliente || '-'}
                                                    {item.ped_cliente && ` • PC: ${item.ped_cliente}`}
                                                </div>
                                            </div>
                                            <span className="font-black text-emerald-600 text-xs shrink-0">
                                                {item.quantidade_solicitada} un
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Opções de Destino (Opção 1 e Opção 2) */}
                            <div className="space-y-3">
                                <label className="block text-xs font-black uppercase text-slate-700 tracking-wider">
                                    Escolha como deseja faturar (Opção 1 ou Opção 2):
                                </label>

                                {loadingSolicitacoes ? (
                                    <div className="flex items-center justify-center p-5 gap-2.5 text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                                        <Loader2 className="animate-spin text-indigo-500" size={16} />
                                        Buscando solicitações em aberto...
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {/* Opção 1: Inserir em Solicitação Existente */}
                                        <div
                                            onClick={() => {
                                                if (openSolicitacoes.length > 0) {
                                                    setFaturarTargetMode('existing');
                                                    if (!selectedSolicitacaoId && openSolicitacoes[0]) {
                                                        setSelectedSolicitacaoId(String(openSolicitacoes[0].id));
                                                    }
                                                }
                                            }}
                                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                                openSolicitacoes.length === 0
                                                    ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                                                    : faturarTargetMode === 'existing'
                                                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm'
                                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="radio"
                                                    id="target-existing"
                                                    name="faturarTargetMode"
                                                    value="existing"
                                                    disabled={openSolicitacoes.length === 0}
                                                    checked={faturarTargetMode === 'existing'}
                                                    onChange={() => {
                                                        if (openSolicitacoes.length > 0) {
                                                            setFaturarTargetMode('existing');
                                                        }
                                                    }}
                                                    className="mt-1 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                                                            Opção 1
                                                        </span>
                                                        <span className="font-black text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                                                            <FolderInput size={15} className="text-indigo-600 shrink-0" />
                                                            Inserir em Solicitação Existente
                                                        </span>
                                                        {openSolicitacoes.length > 0 ? (
                                                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full ml-auto">
                                                                {openSolicitacoes.length} em aberto
                                                            </span>
                                                        ) : (
                                                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto">
                                                                Nenhuma aberta
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-1 mb-2">
                                                        Anexa {faturarModalItems.length === 1 ? 'o item' : `todos os ${faturarModalItems.length} itens selecionados`} a uma solicitação que já está tramitando na expedição.
                                                    </p>

                                                    {faturarTargetMode === 'existing' && (
                                                        openSolicitacoes.length > 0 ? (
                                                            <div className="mt-2.5 pt-2 border-t border-indigo-100">
                                                                <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-1">
                                                                    Selecione a Solicitação Aberta:
                                                                </label>
                                                                <select
                                                                    value={selectedSolicitacaoId}
                                                                    onChange={e => setSelectedSolicitacaoId(e.target.value)}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="w-full bg-white border border-indigo-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                                                >
                                                                    {openSolicitacoes.map(s => (
                                                                        <option key={s.id} value={s.id}>
                                                                            {s.numero_solicitacao} • {s.qtd_itens_diferentes || 1} {s.qtd_itens_diferentes === 1 ? 'item' : 'itens'} • {s.usuario || 'Expedição'} ({new Date(s.created_at).toLocaleDateString('pt-BR')})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2">
                                                                <AlertCircle size={15} className="shrink-0" />
                                                                <span>Nenhuma solicitação em aberto encontrada no momento. Utilize a <strong>Opção 2</strong>.</span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Opção 2: Criar Nova Solicitação */}
                                        <div
                                            onClick={() => setFaturarTargetMode('new')}
                                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                                faturarTargetMode === 'new'
                                                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-sm'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="radio"
                                                    id="target-new"
                                                    name="faturarTargetMode"
                                                    value="new"
                                                    checked={faturarTargetMode === 'new'}
                                                    onChange={() => setFaturarTargetMode('new')}
                                                    className="mt-1 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                                                            Opção 2
                                                        </span>
                                                        <span className="font-black text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                                                            <FilePlus2 size={15} className="text-indigo-600 shrink-0" />
                                                            Criar Nova Solicitação de Faturamento
                                                        </span>
                                                        <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full ml-auto">
                                                            Novo Protocolo FAT
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-1">
                                                        Gera um novo protocolo único oficial (ex: FAT-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-XXX) contendo {faturarModalItems.length === 1 ? 'este item' : `todos os ${faturarModalItems.length} itens selecionados`}.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Opção de Apontamento de Produção */}
                            {faturarModalItems.some(it => Boolean(it.op_num)) && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={executarApontamento}
                                            onChange={e => setExecutarApontamento(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                        />
                                        <span className="text-xs font-bold text-slate-700">
                                            Executar apontamento automático de produção das OPs vinculadas aos itens
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Footer Ações */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setFaturarModalItems([])}
                                disabled={isSubmittingFaturamento}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmFaturamento}
                                disabled={isSubmittingFaturamento || loadingSolicitacoes || (faturarTargetMode === 'existing' && openSolicitacoes.length === 0)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSubmittingFaturamento ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        Processando {faturarModalItems.length} item(ns)...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={15} />
                                        {faturarTargetMode === 'existing' ? `Inserir na Solicitação (${faturarModalItems.length})` : `Criar Solicitação (${faturarModalItems.length})`}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
