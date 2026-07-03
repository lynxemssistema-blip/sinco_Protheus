import React, { useState, useEffect } from 'react';
import { api, createFaturamentoSolicitacao } from '../../services/api';
import { toast } from 'react-toastify';
import { Loader2, Printer, Check, User, Calendar, Trash2, Edit, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import LabelPrintModal from './LabelPrintModal';

export default function PreEtiquetasPendentes() {
    const { user } = useAuth();
    const [pendentes, setPendentes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Label Modal State
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [selectedForLabel, setSelectedForLabel] = useState(null);

    // Execution / Edit State
    const [isExecutingId, setIsExecutingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editQty, setEditQty] = useState('');

    const loadPendentes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/faturamento/pre-etiquetas/pendentes');
            setPendentes(res.data);
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

    const handlePrint = (item) => {
        // Formatar os dados para o formato esperado pelo LabelPrintModal
        // O LabelPrintModal espera os dados dentro de `item.item` 
        // e um campo quantidade que vamos passar
        setSelectedForLabel({
            ...item,
            codigo: item.produto_codigo,
            descricao: item.produto_descricao,
            op_num_completa: item.op_num,
            // As vars do pcp
            _pcp_prog: {
                id: item.pcp_forecast_id,
                data_entrega_pcp: item.pcp_data_entrega,
                serie_cliente: item.pcp_serie_cliente,
                serie_metalfisa: item.pcp_serie_metalfisa,
                numero_serie: item.pcp_numero_serie,
                lote: item.pcp_lote,
                numero_lote: item.pcp_numero_lote,
            },
            cartQty: item.quantidade_solicitada
        });
        setShowLabelModal(true);
    };

    const handleLabelPrinted = async () => {
        setShowLabelModal(false);
        // Não atualizamos para EXECUTADO só por imprimir, pois ela pode querer imprimir antes de faturar.
        // Se desejar marcar como executado automaticamente, decomentar a linha abaixo e tratar a Promise.
        // await api.put(`/faturamento/pre-etiquetas/${selectedForLabel.id}/impresso`);
        toast.info("Etiqueta impressa.");
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

    const handleExecute = async (item) => {
        // Pergunta se deseja faturar com a quantidade X
        const confirmMsg = `Gerar Solicitação de Faturamento para o Pedido ${item.pedido} Item ${item.item} com a quantidade ${item.quantidade_solicitada}?`;
        if (!window.confirm(confirmMsg)) return;

        setIsExecutingId(item.id);
        try {
            // Formatar os itens para o formato que a rota de solicitação espera
            const itemsToSubmit = [{
                pedido: item.pedido,
                item: item.item,
                codigo: item.produto_codigo,
                descricao: item.produto_descricao,
                op_num_completa: item.op_num,
                quantidade_solicitada: parseFloat(item.quantidade_solicitada),
                executar_apontamento: item.op_num ? true : false,
                quantidade_apontamento: parseFloat(item.quantidade_solicitada),
                
                // Dados do PCP
                pcp_forecast_id: item.pcp_forecast_id,
                pcp_data_entrega: item.pcp_data_entrega,
                pcp_serie_cliente: item.pcp_serie_cliente,
                pcp_serie_metalfisa: item.pcp_serie_metalfisa,
                pcp_numero_serie: item.pcp_numero_serie,
                pcp_lote: item.pcp_lote,
                pcp_numero_lote: item.pcp_numero_lote
            }];

            const responseData = await createFaturamentoSolicitacao({
                usuario: user?.nome || 'Sistema',
                observacao: `Gerado via Pré-Lista de Etiqueta (Op: ${item.criado_por})`,
                items: itemsToSubmit
            });
            
            // Marca como executado no banco da pré-lista
            await api.put(`/faturamento/pre-etiquetas/${item.id}/impresso`);
            
            toast.success("Solicitação de faturamento gerada com sucesso!");
            loadPendentes();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Erro ao gerar solicitação.");
        } finally {
            setIsExecutingId(null);
        }
    };

    const ActionButtons = ({ p }) => (
        <>
            <button
                onClick={() => handlePrint(p)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-sm"
                title="Imprimir Etiqueta"
            >
                <Printer size={15} /> <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
                onClick={() => handleExecute(p)}
                disabled={isExecutingId === p.id || editingId === p.id}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-sm disabled:opacity-50"
                title="Gerar Solicitação de Faturamento"
            >
                {isExecutingId === p.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Faturar
            </button>
            <button
                onClick={() => handleDelete(p.id)}
                className="text-red-400 hover:text-red-600 p-2"
                title="Cancelar Pré-Lista"
            >
                <Trash2 size={17} />
            </button>
        </>
    );

    const QtyField = ({ p }) => (
        editingId === p.id ? (
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    inputMode="numeric"
                    value={editQty}
                    onChange={e => setEditQty(e.target.value)}
                    className="w-20 border border-slate-300 rounded p-1.5 text-center font-bold text-sm"
                />
                <button onClick={() => handleSaveEdit(p.id)} className="bg-emerald-100 text-emerald-700 p-1.5 rounded hover:bg-emerald-200">
                    <Check size={14} />
                </button>
                <button onClick={() => setEditingId(null)} className="bg-slate-100 text-slate-600 p-1.5 rounded hover:bg-slate-200">
                    <X size={14} />
                </button>
            </div>
        ) : (
            <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-800">{p.quantidade_solicitada} un</span>
                <button
                    onClick={() => { setEditingId(p.id); setEditQty(p.quantidade_solicitada); }}
                    className="text-slate-400 hover:text-indigo-600"
                    title="Editar Quantidade"
                >
                    <Edit size={14} />
                </button>
            </div>
        )
    );

    return (
        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6 h-full overflow-y-auto w-full pb-40">
            <div className="flex justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm gap-3 shrink-0">
                <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-800">Pré-Listas Pendentes</h2>
                    <p className="text-slate-500 text-xs sm:text-sm hidden sm:block">Itens separados pelos operadores aguardando impressão e faturamento.</p>
                </div>
                <button onClick={loadPendentes} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shrink-0">
                    Atualizar
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-indigo-500" size={40} />
                </div>
            ) : pendentes.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
                    <Check className="mx-auto text-emerald-400 mb-4" size={48} />
                    <h3 className="text-xl font-bold text-slate-700">Tudo em dia!</h3>
                    <p className="text-slate-500">Não há pré-listas pendentes no momento.</p>
                </div>
            ) : (
                <>
                    {/* Mobile: Cards */}
                    <div className="flex flex-col gap-3 sm:hidden">
                        {pendentes.map(p => (
                            <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <User size={13} className="text-slate-400" />
                                            <span className="font-semibold text-slate-700 text-sm">{p.criado_por}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-slate-400">
                                            <Calendar size={11} />
                                            <span>{new Date(p.criado_em).toLocaleString('pt-BR')}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">PED {p.pedido}</span>
                                        <div className="text-xs text-slate-500 mt-0.5">IT: {p.item}{p.op_num ? ` · OP: ${p.op_num}` : ''}</div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-lg p-2.5">
                                    <div className="font-bold text-slate-800 text-sm">{p.produto_codigo}</div>
                                    <div className="text-xs text-slate-500 line-clamp-2">{p.produto_descricao}</div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <QtyField p={p} />
                                    <div className="flex items-center gap-1.5">
                                        <ActionButtons p={p} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tablet/Desktop: Tabela */}
                    <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                    <th className="p-4 font-bold">Origem</th>
                                    <th className="p-4 font-bold">Pedido / Item</th>
                                    <th className="p-4 font-bold">Produto</th>
                                    <th className="p-4 font-bold">Qtd Solicitada</th>
                                    <th className="p-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendentes.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <User size={16} className="text-slate-400" />
                                                <span className="font-semibold text-slate-700">{p.criado_por}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                <Calendar size={12} />
                                                <span>{new Date(p.criado_em).toLocaleString('pt-BR')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-indigo-600">PED: {p.pedido}</div>
                                            <div className="font-bold text-slate-500 text-xs">IT: {p.item}</div>
                                            {p.op_num && <div className="text-xs text-slate-400 mt-1">OP: {p.op_num}</div>}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{p.produto_codigo}</div>
                                            <div className="text-xs text-slate-500 line-clamp-2">{p.produto_descricao}</div>
                                        </td>
                                        <td className="p-4">
                                            <QtyField p={p} />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-end items-center gap-2">
                                                <ActionButtons p={p} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {showLabelModal && selectedForLabel && (
                <LabelPrintModal
                    item={selectedForLabel}
                    cartQty={selectedForLabel.cartQty} // O Modal Label usa cartQty
                    onClose={handleLabelPrinted}
                />
            )}
        </div>
    );
}
