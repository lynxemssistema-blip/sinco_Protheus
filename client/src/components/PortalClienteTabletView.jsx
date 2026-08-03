import React, { useState, useEffect } from 'react';
import { Search, Info, CheckCircle, AlertTriangle, FileText, Minus, Plus, Inbox, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function PortalClienteTabletView({ user, allOrderItems = [], onOpenDrawing }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState([]);
    
    // Armazena as quantidades alocadas { 'pedido-item': { quantidade, rowData } }
    const [allocatedItems, setAllocatedItems] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // Controle de distribuição automática por lote/peças
    const [totalPecas, setTotalPecas] = useState('');
    const [manualOverrides, setManualOverrides] = useState(new Set());

    // Tipo de solicitação e observações
    const [tipoSolicitacao, setTipoSolicitacao] = useState('Atualização de Dados');
    const [observacao, setObservacao] = useState('');

    const normalizeString = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
            .trim();
    };

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        
        const query = searchQuery.trim();
        if (!query) {
            setResults([]);
            setAllocatedItems({});
            return;
        }

        const normalizedQuery = normalizeString(query);

        // Filtra os itens recebidos com base na Ordem de Compra (ped_cliente / pc) ou Ref. Cliente
        const matchedItems = allOrderItems.filter(item => {
            const oc = item.ped_cliente || item.pc || '';
            const ref = item.ref_cliente || '';
            
            const normalizedOc = normalizeString(oc);
            const normalizedRef = normalizeString(ref);

            return normalizedOc.includes(normalizedQuery) || normalizedRef.includes(normalizedQuery);
        });

        // Ordena os itens ativos com saldo primeiro
        matchedItems.sort((a, b) => {
            const saldoA = Number(a.saldo_faturar || a.saldo_item || 0);
            const saldoB = Number(b.saldo_faturar || b.saldo_item || 0);
            return saldoB - saldoA;
        });

        setResults(matchedItems);
        setTotalPecas('');
        setManualOverrides(new Set());
        setAllocatedItems({});
    };

    // Atualiza os resultados automaticamente quando todos os itens mudam (ex: ao atualizar dados)
    useEffect(() => {
        if (searchQuery.trim()) {
            handleSearch();
        }
    }, [allOrderItems]);

    const handleTotalPecasChange = (val) => {
        let numericVal = parseFloat(val);
        if (isNaN(numericVal) || numericVal < 0) {
            numericVal = '';
        }
        
        setTotalPecas(numericVal);
        const nextOverrides = new Set();
        setManualOverrides(nextOverrides);
        
        if (numericVal === '') {
            setAllocatedItems({});
            return;
        }
        
        let remaining = numericVal;
        const nextSelected = {};
        
        results.forEach(row => {
            const key = `${row.pedido}-${row.item}`;
            const maxSaldo = parseFloat(row.saldo_faturar || row.saldo_item || 0);
            if (remaining > 0 && maxSaldo > 0) {
                const allocated = Math.min(maxSaldo, remaining);
                nextSelected[key] = {
                    quantidade: allocated,
                    rowData: row
                };
                remaining -= allocated;
            }
        });
        
        setAllocatedItems(nextSelected);
    };

    const handleQuantityChange = (row, qty) => {
        let val = parseFloat(qty);
        const maxSaldo = parseFloat(row.saldo_faturar || row.saldo_item || 0);
        
        if (isNaN(val) || val < 0) val = 0;
        if (val > maxSaldo) {
            val = maxSaldo;
            toast.warning(`A quantidade máxima disponível para este item é ${maxSaldo}.`);
        }
        
        const key = `${row.pedido}-${row.item}`;
        const nextOverrides = new Set(manualOverrides);
        nextOverrides.add(key);
        setManualOverrides(nextOverrides);
        
        const nextSelected = { ...allocatedItems };
        if (val === 0) {
            delete nextSelected[key];
        } else {
            nextSelected[key] = {
                quantidade: val,
                rowData: row
            };
        }
        
        if (totalPecas !== '') {
            let sumOverrides = 0;
            nextOverrides.forEach(k => {
                if (nextSelected[k]) {
                    sumOverrides += nextSelected[k].quantidade;
                }
            });
            
            let remaining = Math.max(0, totalPecas - sumOverrides);
            
            results.forEach(item => {
                const itemKey = `${item.pedido}-${item.item}`;
                if (!nextOverrides.has(itemKey)) {
                    const itemSaldo = parseFloat(item.saldo_faturar || item.saldo_item || 0);
                    if (remaining > 0 && itemSaldo > 0) {
                        const allocated = Math.min(itemSaldo, remaining);
                        nextSelected[itemKey] = {
                            quantidade: allocated,
                            rowData: item
                        };
                        remaining -= allocated;
                    } else {
                        delete nextSelected[itemKey];
                    }
                }
            });
        }
        
        setAllocatedItems(nextSelected);
    };

    const handleSend = async () => {
        const selectedList = Object.values(allocatedItems);
        if (selectedList.length === 0) {
            return toast.warning("Aloque pelo menos 1 peça em algum pedido para enviar.");
        }

        setIsSaving(true);
        try {
            const promises = selectedList.map(async ({ quantidade, rowData }) => {
                const finalObservacao = `[Qtd Solicitada: ${quantidade} ${rowData.unidade || 'pç'}]\n\n${observacao}`;
                const oc = rowData.ordem_compra || rowData.ped_cliente || rowData.pc || null;

                const payload = {
                    cliente_nome: user?.nome || user?.nome_cliente || 'Cliente Portal',
                    pedido_metalfisa: rowData.pedido,
                    pedido_cliente: oc === '-' ? null : oc,
                    produto: rowData.produto,
                    ref_cliente: rowData.ref_cliente || null,
                    tipo_solicitacao: tipoSolicitacao,
                    observacao: finalObservacao,
                    criado_por: user?.nome || 'Sistema'
                };
                
                const { data } = await api.post('/clients/solicitacoes', payload);
                return data?.data?.id || null;
            });

            const insertedIds = await Promise.all(promises);
            const validIds = insertedIds.filter(id => id !== null);

            toast.success(`Solicitações enviadas com sucesso! Protocolos: ${validIds.map(id => `SOL-${String(id).padStart(5, '0')}`).join(', ')}`);
            
            // Limpa formulário pós envio
            setAllocatedItems({});
            setTotalPecas('');
            setSearchQuery('');
            setResults([]);
            setObservacao('');
        } catch (err) {
            console.error("Erro ao salvar solicitações rápidas:", err);
            toast.error("Erro ao processar as solicitações. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative select-none">
            {/* Toolbar Busca */}
            <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Pesquisar por Ordem de Compra ou Ref. Cliente..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#152943] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
                    >
                        Buscar
                    </button>
                </form>

                {results.length > 0 && (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shrink-0">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Distribuição Rápida:</span>
                        <input
                            type="number"
                            min="0"
                            placeholder="Qtd Total"
                            value={totalPecas}
                            onChange={(e) => handleTotalPecasChange(e.target.value)}
                            className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                )}
            </div>

            {/* Listagem de Cards */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
                {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-3xs p-6">
                        <Inbox className="w-12 h-12 opacity-30 text-blue-600 mb-2" />
                        <p className="text-sm font-bold text-slate-700">Digite a Ordem de Compra (PC) ou Referência do Cliente.</p>
                        <p className="text-xs text-slate-500 text-center max-w-xs mt-1">O sistema buscará todos os itens com saldo pendente para alocação de quantidade rápida.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map((row) => {
                            const key = `${row.pedido}-${row.item}`;
                            const allocated = allocatedItems[key]?.quantidade || 0;
                            const maxSaldo = Number(row.saldo_faturar || row.saldo_item || 0);

                            return (
                                <div key={key} className="bg-white border border-slate-200 rounded-2xl shadow-3xs p-4 flex flex-col justify-between gap-4 transition-all hover:shadow-2xs">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <div className="font-mono text-xs">
                                                <span className="text-slate-400">Ped. MF:</span> <strong className="text-slate-700">{row.pedido}</strong>
                                            </div>
                                            <div className="font-mono text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-600">
                                                Item: {row.item}
                                            </div>
                                        </div>

                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between font-mono">
                                                <span className="text-slate-400">Ordem Compra:</span>
                                                <span className="font-bold text-slate-800">{row.ped_cliente || row.pc || '—'}</span>
                                            </div>
                                            <div className="flex justify-between font-mono">
                                                <span className="text-slate-400">Ref. Cliente:</span>
                                                <span className="font-semibold text-slate-700">{row.ref_cliente || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Produto / Código:</span>
                                                <span className="font-bold text-blue-700 font-mono">{row.produto}</span>
                                            </div>
                                            <div className="text-slate-500 font-medium truncate max-w-full text-[11px]" title={row.desc_produto}>
                                                {row.desc_produto}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                                        <button
                                            onClick={() => onOpenDrawing && onOpenDrawing(row.desenho_url, row.produto)}
                                            className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-red-500" />
                                            <span>Desenho PDF</span>
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-1">
                                                Saldo: {maxSaldo} {row.unidade || 'UN'}
                                            </span>

                                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shrink-0 bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(row, allocated - 1)}
                                                    disabled={allocated <= 0}
                                                    className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 text-slate-600 border-r border-slate-200 cursor-pointer"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                
                                                <input
                                                    type="number"
                                                    value={allocated || ''}
                                                    placeholder="0"
                                                    onChange={(e) => handleQuantityChange(row, e.target.value)}
                                                    className="w-14 text-center font-bold text-slate-800 text-xs focus:outline-none outline-none"
                                                />
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(row, allocated + 1)}
                                                    disabled={allocated >= maxSaldo}
                                                    className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-50 text-slate-600 border-l border-slate-200 cursor-pointer"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Rodapé Form de Envio */}
            {results.length > 0 && (
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="md:col-span-1 space-y-2">
                            <label className="block font-bold text-slate-700">Tipo de Solicitação</label>
                            <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="Atualização de Dados"
                                        checked={tipoSolicitacao === 'Atualização de Dados'}
                                        onChange={(e) => setTipoSolicitacao(e.target.value)}
                                        className="text-blue-600"
                                    />
                                    <span>Atualização de Dados</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="Peças em Linha de Produção"
                                        checked={tipoSolicitacao === 'Peças em Linha de Produção'}
                                        onChange={(e) => setTipoSolicitacao(e.target.value)}
                                        className="text-blue-600"
                                    />
                                    <span>Priorizar na Produção</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="Peças Para Próxima Sequência de Montagem"
                                        checked={tipoSolicitacao === 'Peças Para Próxima Sequência de Montagem'}
                                        onChange={(e) => setTipoSolicitacao(e.target.value)}
                                        className="text-blue-600"
                                    />
                                    <span>Próxima Seq. Montagem</span>
                                </label>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-2 flex flex-col">
                            <label className="block font-bold text-slate-700">Observações adicionais (opcional)</label>
                            <textarea
                                rows={3}
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                placeholder="Digite alguma observação sobre as peças ou prazos solicitados..."
                                className="w-full flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="text-xs text-slate-500 font-semibold">
                            Itens alocados: <strong className="text-slate-700">{Object.keys(allocatedItems).length}</strong>
                        </div>
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={isSaving || Object.keys(allocatedItems).length === 0}
                            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Enviando...</span>
                                </>
                            ) : (
                                <span>Confirmar e Enviar Solicitações</span>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
