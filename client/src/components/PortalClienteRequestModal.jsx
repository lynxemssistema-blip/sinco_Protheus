import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function PortalClienteRequestModal({ isOpen, onClose, selectedItems = [], user, allOrderItems = [] }) {
    const [tipoSolicitacao, setTipoSolicitacao] = useState('Atualização de Dados');
    const [nivel, setNivel] = useState('produto'); // 'produto' ou 'pedido'
    const [observacao, setObservacao] = useState('');
    const [quantidades, setQuantidades] = useState({});
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen && selectedItems && selectedItems.length > 0) {
            const qMap = {};
            selectedItems.forEach(item => {
                const saldo = item.saldo_item !== undefined ? item.saldo_item : (item.saldo_faturar || 0);
                qMap[item.id] = saldo;
            });
            setQuantidades(qMap);
            setNivel('produto');
            setObservacao('');
            setTipoSolicitacao('Atualização de Dados');
        }
    }, [isOpen, selectedItems]);

    if (!isOpen || !selectedItems || selectedItems.length === 0) return null;

    // Use o primeiro item como referência para dados básicos de exibição
    const representativeItem = selectedItems[0];
    const representativeOc = representativeItem.ordem_compra || representativeItem.ped_cliente || representativeItem.pc || '-';

    const handleSend = async () => {
        setIsProcessing(true);
        try {
            if (nivel === 'pedido') {
                // Agrupa os itens selecionados por Pedido MetalFisa e envia uma solicitação para cada pedido
                const uniquePedidos = [...new Set(selectedItems.map(i => i.pedido))];
                
                const promises = uniquePedidos.map(async (ped) => {
                    const orderItems = allOrderItems.filter(item => String(item.pedido).trim() === String(ped).trim());
                    const itemsListText = orderItems.map(item => `- ${item.produto} (Ref: ${item.ref_cliente || '-'}): Saldo ${item.saldo_faturar || item.saldo_item || 0}`).join('\n');
                    const finalObservacao = `[Itens do Pedido para Atualização]\n${itemsListText}\n\n${observacao}`;

                    const rep = selectedItems.find(i => i.pedido === ped) || orderItems[0];
                    const oc = rep.ordem_compra || rep.ped_cliente || rep.pc || null;

                    const payload = {
                        cliente_nome: user?.nome || user?.nome_cliente || 'Cliente Portal',
                        pedido_metalfisa: ped,
                        pedido_cliente: oc === '-' ? null : oc,
                        produto: null,
                        ref_cliente: null,
                        tipo_solicitacao: tipoSolicitacao,
                        observacao: finalObservacao,
                        criado_por: user?.nome || 'Sistema'
                    };
                    return api.post('/clients/solicitacoes', payload);
                });
                await Promise.all(promises);
            } else {
                // Nível "produto" (individual)
                // Cria uma solicitação para cada item selecionado
                const promises = selectedItems.map(async (item) => {
                    const qty = quantidades[item.id] !== undefined ? quantidades[item.id] : (item.saldo_item !== undefined ? item.saldo_item : (item.saldo_faturar || 0));
                    const finalObservacao = `[Qtd Solicitada: ${qty} ${item.unidade || 'pç'}]\n\n${observacao}`;
                    const oc = item.ordem_compra || item.ped_cliente || item.pc || null;

                    const payload = {
                        cliente_nome: user?.nome || user?.nome_cliente || 'Cliente Portal',
                        pedido_metalfisa: item.pedido,
                        pedido_cliente: oc === '-' ? null : oc,
                        produto: item.produto,
                        ref_cliente: item.ref_cliente || null,
                        tipo_solicitacao: tipoSolicitacao,
                        observacao: finalObservacao,
                        criado_por: user?.nome || 'Sistema'
                    };
                    return api.post('/clients/solicitacoes', payload);
                });
                await Promise.all(promises);
            }

            toast.success('Solicitação enviada com sucesso! Nossa equipe foi notificada.');
            onClose();
        } catch (err) {
            console.error('Erro ao enviar solicitação:', err);
            toast.error('Ocorreu um erro ao enviar. Tente novamente.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh] animate-fade-in-up">
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-white font-bold text-lg">
                        Nova Solicitação {selectedItems.length > 1 ? `(${selectedItems.length} itens)` : ''}
                    </h2>
                    <button onClick={onClose} disabled={isProcessing} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    
                    {/* Item Info Summary */}
                    {selectedItems.length === 1 ? (
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-slate-500">Pedido MetalFisa:</span> <strong className="text-slate-800">{representativeItem.pedido}</strong></div>
                                <div><span className="text-slate-500">Ordem de Compra:</span> <strong className="text-slate-800">{representativeOc}</strong></div>
                                {nivel === 'produto' && (
                                    <>
                                        <div><span className="text-slate-500">Produto:</span> <strong className="text-slate-800">{representativeItem.produto}</strong></div>
                                        <div><span className="text-slate-500">Ref. Cliente:</span> <strong className="text-slate-800">{representativeItem.ref_cliente || '-'}</strong></div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                            <span className="text-slate-500 font-semibold uppercase block mb-1">Resumo da Seleção</span>
                            <p className="text-slate-700">Você selecionou <strong>{selectedItems.length} itens</strong> de faturamento.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Nível da Solicitação</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="nivel" 
                                    value="produto" 
                                    checked={nivel === 'produto'} 
                                    onChange={(e) => setNivel(e.target.value)}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">
                                    {selectedItems.length === 1 ? 'Apenas para este Produto' : 'Para os itens selecionados individualmente'}
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="nivel" 
                                    value="pedido" 
                                    checked={nivel === 'pedido'} 
                                    onChange={(e) => setNivel(e.target.value)}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700 font-medium">Para toda a Ordem de Compra/Pedido</span>
                            </label>
                        </div>
                    </div>

                    {nivel === 'produto' && (
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 border border-slate-200/80 rounded-xl p-3 bg-slate-50/50">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Quantidades por Item Solicitado</label>
                            {selectedItems.map((item) => {
                                const saldo = item.saldo_item !== undefined ? item.saldo_item : (item.saldo_faturar || 0);
                                return (
                                    <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-3xs">
                                        <div className="font-mono flex-1">
                                            <div className="font-bold text-slate-800 truncate max-w-[240px]" title={item.produto}>{item.produto}</div>
                                            <div className="text-[10px] text-slate-400">Ped: {item.pedido} | OC: {item.ordem_compra || item.ped_cliente || item.pc || '-'}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.0001"
                                                value={quantidades[item.id] !== undefined ? quantidades[item.id] : saldo}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setQuantidades(prev => ({ ...prev, [item.id]: val }));
                                                }}
                                                className="w-20 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 text-center text-xs"
                                            />
                                            <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">
                                                Saldo: {saldo} {item.unidade}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {nivel === 'pedido' && allOrderItems && allOrderItems.length > 0 && (
                        <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2">
                            <span className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Itens e saldos incluídos nesta solicitação:</span>
                            <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1">
                                {allOrderItems
                                    .filter(item => selectedItems.some(sel => String(sel.pedido).trim() === String(item.pedido).trim()))
                                    .map((item, idx) => (
                                        <div key={idx} className="text-xs font-mono flex items-center justify-between gap-3 bg-white p-2 rounded border border-slate-200">
                                            <span className="truncate max-w-[200px] font-semibold text-slate-700" title={item.produto}>
                                                {item.produto} {item.ref_cliente && item.ref_cliente !== '-' ? `(Ref: ${item.ref_cliente})` : ''}
                                            </span>
                                            <span className="text-amber-800 font-bold whitespace-nowrap bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                                                Saldo: {item.saldo_faturar || item.saldo_item || 0} {item.unidade}
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Solicitação</label>
                        <select
                            value={tipoSolicitacao}
                            onChange={(e) => setTipoSolicitacao(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        >
                            <option value="Atualização de Dados">Atualização de Dados (Previsões, Status)</option>
                            <option value="Peças em Linha de Produção">Peças em Linha de Produção (Prioridade)</option>
                            <option value="Peças Para Próxima Sequência de Montagem">Peças Para Próxima Sequência de Montagem</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Observações (Opcional)</label>
                        <textarea
                            rows={3}
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Descreva a urgência ou qualquer detalhe importante para nossa equipe..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>
                    
                    <div className="bg-amber-50 p-3 rounded-lg flex items-start gap-2 border border-amber-100">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                            Sua solicitação será enviada diretamente para a equipe de Planejamento (PCP) da MetalFisa. O retorno acontecerá o mais breve possível.
                        </p>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isProcessing ? 'Enviando...' : (
                            <>
                                <Send className="w-4 h-4" /> Enviar Solicitação
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
