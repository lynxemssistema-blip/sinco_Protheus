import React, { useState } from 'react';
import { Search, Loader2, Save, ShoppingCart, Info, Factory, User, CheckCircle, AlertTriangle } from 'lucide-react';
import { api, getPedidosFlat } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function PreEtiquetasTabletView({ onNavigateList }) {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    
    // Armazena as quantidades separadas { 'pedido-item': { quantidade, op_num, rowData } }
    const [selectedItems, setSelectedItems] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // Controle de distribuição automática por lote/peças
    const [totalPecas, setTotalPecas] = useState('');
    const [manualOverrides, setManualOverrides] = useState(new Set());

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) {
            return toast.warning("Digite o número do desenho (produto).");
        }

        setLoading(true);
        try {
            // Busca pedidos ativos que contenham o produto
            const response = await getPedidosFlat({
                produto: searchQuery.trim(),
                only_active: 'true',
                limit: 200
            });
            
            if (response.data && response.data.length > 0) {
                // Remove duplicates in case of multiple OPs for the same item. We just want to list the item.
                const uniqueItems = [];
                const seen = new Set();
                
                response.data.forEach(row => {
                    const key = `${row.pedido}-${row.item}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueItems.push(row);
                    }
                });
                
                // Prioritize items with is_priority === true, then by higher saldo
                uniqueItems.sort((a, b) => {
                    if (a.is_priority && !b.is_priority) return -1;
                    if (!a.is_priority && b.is_priority) return 1;
                    return (parseFloat(b.qtd_faturar) || 0) - (parseFloat(a.qtd_faturar) || 0);
                });
                
                setResults(uniqueItems);
                
                // Reset distribution states on a fresh successful search
                setTotalPecas('');
                setManualOverrides(new Set());
                setSelectedItems({});
            } else {
                setResults([]);
                toast.info("Nenhum pedido ativo encontrado para este desenho.");
            }
        } catch (err) {
            console.error("Erro ao buscar desenho:", err);
            toast.error("Erro ao realizar a busca.");
        } finally {
            setLoading(false);
        }
    };

    const handleTotalPecasChange = (val) => {
        let numericVal = parseFloat(val);
        if (isNaN(numericVal) || numericVal < 0) {
            numericVal = '';
        }
        
        setTotalPecas(numericVal);
        
        // Reset manual overrides when changing total pieces
        const nextOverrides = new Set();
        setManualOverrides(nextOverrides);
        
        if (numericVal === '') {
            setSelectedItems({});
            return;
        }
        
        // Distribute numericVal sequentially among results
        let remaining = numericVal;
        const nextSelected = {};
        
        results.forEach(row => {
            const key = `${row.pedido}-${row.item}`;
            const maxSaldo = parseFloat(row.qtd_faturar) || 0;
            if (remaining > 0 && maxSaldo > 0) {
                const allocated = Math.min(maxSaldo, remaining);
                nextSelected[key] = {
                    quantidade: allocated,
                    op_num: row.op_num_completa || row.op_num || null,
                    rowData: row
                };
                remaining -= allocated;
            }
        });
        
        setSelectedItems(nextSelected);
    };

    const handleQuantityChange = (row, qty) => {
        let val = parseFloat(qty);
        const maxSaldo = parseFloat(row.qtd_faturar) || 0;
        
        if (isNaN(val) || val < 0) val = '';
        if (val !== '' && val > maxSaldo) {
            val = maxSaldo;
            toast.warning(`A quantidade máxima a faturar para este item é ${maxSaldo}.`);
        }
        
        const key = `${row.pedido}-${row.item}`;
        
        // Mark this key as manually overridden
        const nextOverrides = new Set(manualOverrides);
        nextOverrides.add(key);
        setManualOverrides(nextOverrides);
        
        // Update this item's value in a temporary selected items map
        const nextSelected = { ...selectedItems };
        if (val === '' || val === 0) {
            delete nextSelected[key];
        } else {
            nextSelected[key] = {
                quantidade: val,
                op_num: row.op_num_completa || row.op_num || null,
                rowData: row
            };
        }
        
        // Recalculate distribution for non-overridden items if totalPecas is active
        if (totalPecas !== '') {
            // Sum of manual overrides
            let sumOverrides = 0;
            nextOverrides.forEach(k => {
                if (nextSelected[k]) {
                    sumOverrides += nextSelected[k].quantidade;
                }
            });
            
            let remaining = Math.max(0, totalPecas - sumOverrides);
            
            // Distribute remaining sequentially to non-overridden items
            results.forEach(item => {
                const itemKey = `${item.pedido}-${item.item}`;
                if (!nextOverrides.has(itemKey)) {
                    const maxSaldo = parseFloat(item.qtd_faturar) || 0;
                    if (remaining > 0 && maxSaldo > 0) {
                        const allocated = Math.min(maxSaldo, remaining);
                        nextSelected[itemKey] = {
                            quantidade: allocated,
                            op_num: item.op_num_completa || item.op_num || null,
                            rowData: item
                        };
                        remaining -= allocated;
                    } else {
                        // Clear quantity for items that get nothing
                        delete nextSelected[itemKey];
                    }
                }
            });
        }
        
        setSelectedItems(nextSelected);
    };

    const handleSaveList = async () => {
        const keys = Object.keys(selectedItems);
        if (keys.length === 0) {
            return toast.warning("Informe a quantidade para pelo menos um item.");
        }

        const itemsToSave = keys.map(k => {
            const data = selectedItems[k];
            const row = data.rowData;
            const prog = row._pcp_prog; // Se existir dados do PCP
            
            return {
                produto_codigo: row.codigo,
                produto_descricao: row.descricao,
                pedido: row.pedido,
                item: row.item,
                op_num: data.op_num,
                quantidade_solicitada: data.quantidade,
                criado_por: user?.NomeCompleto || user?.nome || 'Operador',
                pcp_forecast_id: prog?.id || null,
                pcp_data_entrega: prog?.data_entrega_pcp || null,
                pcp_serie_cliente: prog?.serie_cliente || null,
                pcp_serie_metalfisa: prog?.serie_metalfisa || null,
                pcp_numero_serie: prog?.numero_serie || null,
                pcp_lote: prog?.lote || null,
                pcp_numero_lote: prog?.numero_lote || null
            };
        });

        setIsSaving(true);
        try {
            await api.post('/faturamento/pre-etiquetas', { items: itemsToSave });
            toast.success("Itens enviados para a pré-lista de faturamento com sucesso!");
            setSelectedItems({});
            setResults([]);
            setSearchQuery('');
            setTotalPecas('');
            setManualOverrides(new Set());
        } catch (err) {
            console.error(err);
            toast.error("Erro ao enviar pré-lista.");
        } finally {
            setIsSaving(false);
        }
    };

    // Calcular sobras não distribuídas
    const totalDistribuido = Object.values(selectedItems).reduce((sum, item) => sum + (item.quantidade || 0), 0);
    const sobra = totalPecas !== '' ? Math.max(0, totalPecas - totalDistribuido) : 0;

    return (
        <div className="p-3 sm:p-4 md:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-8 animate-fade-in pb-40 h-full overflow-y-auto w-full">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden shrink-0">
                <div className="bg-slate-900 p-4 sm:p-6 md:p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-6">
                        <div>
                            <h2 className="text-xl sm:text-3xl md:text-4xl font-black flex items-center gap-2 sm:gap-3">
                                <Factory className="text-indigo-400 shrink-0" size={24} />
                                Expedição
                            </h2>
                            <p className="text-slate-400 mt-1 text-sm sm:text-base md:text-lg">
                                Busque pelo número do desenho para separar.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-800/80 p-2 sm:p-3 rounded-xl border border-slate-700 backdrop-blur-md w-full sm:w-auto">
                            <User className="text-slate-400 shrink-0" size={18} />
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Operador</p>
                                <p className="font-bold text-white text-sm sm:text-base truncate">{user?.NomeCompleto || user?.nome || '---'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3 sm:p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-4 items-stretch">
                        <form onSubmit={handleSearch} className="relative group flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                                placeholder="NÚMERO DO DESENHO..."
                                className="w-full text-lg sm:text-2xl md:text-3xl font-black text-slate-800 placeholder-slate-300 border-2 border-slate-200 rounded-2xl py-4 sm:py-6 md:py-8 pl-4 sm:pl-8 pr-16 sm:pr-24 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white p-3 sm:p-4 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
                            </button>
                        </form>

                        {results.length > 0 && (
                            <div className="w-full md:w-72 flex flex-col justify-center">
                                <div className="relative">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        value={totalPecas}
                                        onChange={(e) => handleTotalPecasChange(e.target.value)}
                                        placeholder="QTD. TOTAL..."
                                        className="w-full text-lg sm:text-2xl md:text-3xl font-black text-emerald-800 placeholder-emerald-300 border-2 border-emerald-200 bg-emerald-50/50 rounded-2xl py-4 sm:py-6 md:py-8 px-4 sm:px-8 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all outline-none"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 uppercase tracking-wider hidden sm:inline">
                                        Peças
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {sobra > 0 && (
                        <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl animate-fade-in text-xs sm:text-sm font-bold">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                            <span>Aviso: {sobra} peça(s) não puderam ser distribuída(s) por falta de saldo nos pedidos.</span>
                        </div>
                    )}
                </div>
            </div>

            {results.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="bg-emerald-100 text-emerald-700 p-1.5 sm:p-2 rounded-lg">
                            <CheckCircle size={18} />
                        </div>
                        <h3 className="text-base sm:text-xl font-bold text-slate-800">
                            Desenho: <span className="text-indigo-600">{searchQuery}</span>
                            <span className="text-slate-400 font-normal ml-1">({results.length} pedido{results.length > 1 ? 's' : ''})</span>
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                        {results.map((row) => {
                            const key = `${row.pedido}-${row.item}`;
                            const isSelected = selectedItems[key]?.quantidade > 0;
                            const currentQty = selectedItems[key]?.quantidade || '';
                            const saldo = parseFloat(row.qtd_faturar) || 0;

                            return (
                                <div
                                    key={key}
                                    className={`bg-white rounded-2xl p-4 sm:p-6 border-2 transition-all ${
                                        isSelected 
                                            ? 'border-emerald-500 shadow-emerald-500/20 shadow-lg' 
                                            : row.is_priority 
                                                ? 'border-red-400 shadow-red-500/20 shadow-lg' 
                                                : 'border-slate-200 shadow-md hover:border-indigo-300'
                                    }`}
                                >
                                    {row.is_priority && (
                                        <div className="flex items-center gap-1.5 bg-red-100 text-red-700 p-2 sm:p-3 rounded-xl mb-4 border border-red-200">
                                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                            <span className="font-bold text-sm sm:text-base">PEDIDO PRIORITÁRIO</span>
                                            {row.priority_obs && <span className="text-sm hidden sm:inline ml-1">- {row.priority_obs}</span>}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                                <span className={`text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg ${row.is_priority ? 'bg-red-600' : 'bg-slate-800'}`}>
                                                    PED: {row.pedido}
                                                </span>
                                                <span className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg ${row.is_priority ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                                                    IT: {row.item}
                                                </span>
                                            </div>
                                            <p className="text-sm sm:text-lg font-bold text-slate-800 mt-1.5 sm:mt-2 line-clamp-2">
                                                {row.descricao}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 grid grid-cols-2 gap-3 sm:gap-4">
                                        <div className="min-w-0">
                                            <p className="text-xs text-slate-500 font-bold uppercase mb-0.5 sm:mb-1">Cliente</p>
                                            <p className="text-xs sm:text-sm font-bold text-slate-700 truncate" title={row.nome_cliente}>{row.nome_cliente}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase mb-0.5 sm:mb-1">Saldo</p>
                                            <p className="text-base sm:text-lg font-black text-indigo-600">{saldo} un</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2">
                                            Qtd Separada Fisicamente
                                        </label>
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min="0"
                                                max={saldo}
                                                value={currentQty}
                                                onChange={(e) => handleQuantityChange(row, e.target.value)}
                                                placeholder="0"
                                                className={`w-full text-xl sm:text-2xl font-black p-3 sm:p-4 rounded-xl border-2 outline-none transition-all ${
                                                    isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-300 focus:border-indigo-500'
                                                }`}
                                            />
                                            {isSelected && (
                                                <div className="bg-emerald-500 text-white p-3 sm:p-4 rounded-xl flex-shrink-0 animate-scale-up">
                                                    <CheckCircle size={24} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {Object.keys(selectedItems).length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 sm:p-6 shadow-2xl z-50 animate-slide-up">
                    <div className="max-w-5xl mx-auto flex flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="bg-indigo-100 text-indigo-700 p-2 sm:p-4 rounded-full">
                                <ShoppingCart size={20} className="sm:hidden" />
                                <ShoppingCart size={32} className="hidden sm:block" />
                            </div>
                            <div>
                                <p className="text-slate-500 font-bold uppercase tracking-wide text-xs sm:text-sm">Pré-lista</p>
                                <p className="text-lg sm:text-2xl font-black text-slate-800">
                                    {Object.keys(selectedItems).length} {Object.keys(selectedItems).length === 1 ? 'item' : 'itens'}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveList}
                            disabled={isSaving}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm sm:text-xl font-black py-3 sm:py-4 px-4 sm:px-12 rounded-xl sm:rounded-2xl shadow-xl shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-3"
                        >
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            <span className="hidden sm:inline">ENVIAR PARA O </span>FATURAMENTO
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
