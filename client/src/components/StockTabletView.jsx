import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, Loader2, Save, ShoppingCart, Info, Factory, User, 
    CheckCircle, AlertTriangle, ArrowDownLeft, ArrowUpRight, 
    Box, RefreshCw, Layers, History, Check, X, ShieldCheck, Zap 
} from 'lucide-react';
import { getProdutos, getStockBalance, getStockMovements, addStockMovement } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import StockEmpenhoModal from './StockEmpenhoModal';

export default function StockTabletView({ onNavigateCatalog }) {
    const { user } = useAuth();

    // Modo Operacional: 'ENTRADA' | 'SAIDA'
    const [movementType, setMovementType] = useState('ENTRADA'); // 'ENTRADA' | 'SAIDA'
    
    // Busca e Seleção
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [stockBalances, setStockBalances] = useState({ saldoFabrica: 0, saldoProtheus: 0 });

    // Quantidade e Observações
    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Histórico Recente do Produto / Geral
    const [recentMovements, setRecentMovements] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Modal de Empenho Especial para OP
    const [isEmpenhoModalOpen, setIsEmpenhoModalOpen] = useState(false);

    const searchInputRef = useRef(null);

    // Motivos Rápidos Pré-Definidos
    const quickReasonsEntrada = [
        'Levantamento Físico de Fábrica',
        'Sobra de Produção',
        'Devolução de Linha',
        'Retrabalho Concluído',
        'Ajuste de Inventário'
    ];

    const quickReasonsSaida = [
        'Consumo de Linha de Produção',
        'Empenho para OP Específica',
        'Sucata / Avaria de Peça',
        'Ajuste Negativo',
        'Transferência Interna'
    ];

    // Busca de produtos ao digitar ou submeter
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) {
            return toast.warning('Digite o código ou descrição do produto.');
        }

        setIsSearching(true);
        try {
            const res = await getProdutos({
                search: searchQuery.trim(),
                limit: 20
            });
            const prods = res.data || res.produtos || [];
            setSearchResults(prods);

            if (prods.length === 1) {
                handleSelectProduct(prods[0]);
            } else if (prods.length === 0) {
                toast.info('Nenhum produto encontrado com essa busca.');
            }
        } catch (err) {
            console.error('Erro na busca:', err);
            toast.error('Erro ao buscar produtos.');
        } finally {
            setIsSearching(false);
        }
    };

    // Seleciona um produto e busca seus saldos e histórico
    const handleSelectProduct = async (prod) => {
        setSelectedProduct(prod);
        setSearchResults([]);
        setLoadingBalance(true);
        setLoadingHistory(true);
        setQuantidade('');
        setObservacao('');

        try {
            // 1. Saldo atual
            const bal = await getStockBalance(prod.codigo);
            setStockBalances({
                saldoFabrica: parseFloat(bal.saldoFabrica || prod.saldo_fabrica || 0),
                saldoProtheus: parseFloat(bal.saldoProtheus || prod.saldo_protheus || 0)
            });

            // 2. Histórico recente
            const movs = await getStockMovements(prod.codigo);
            setRecentMovements(movs || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingBalance(false);
            setLoadingHistory(false);
        }
    };

    // Incrementar quantidade rápido pelos botões numéricos
    const handleAddQuantity = (increment) => {
        const current = parseFloat(quantidade) || 0;
        const next = Math.max(0, current + increment);
        setQuantidade(String(next));
    };

    // Cálculo do Novo Saldo Previsto
    const qtdNum = parseFloat(quantidade) || 0;
    const novoSaldoEstimado = movementType === 'ENTRADA'
        ? stockBalances.saldoFabrica + qtdNum
        : stockBalances.saldoFabrica - qtdNum;

    // Salvar Movimentação Rápida
    const handleSaveMovement = async () => {
        if (!selectedProduct) {
            return toast.warning('Selecione um produto antes de registrar a movimentação.');
        }

        if (qtdNum <= 0) {
            return toast.warning('Informe uma quantidade maior que zero.');
        }

        if (movementType === 'SAIDA' && qtdNum > stockBalances.saldoFabrica) {
            // Alerta mas não trava se for ajuste negativo explícito
            if (!window.confirm(`Atenção: A saída (${qtdNum} un) é maior que o saldo atual da fábrica (${stockBalances.saldoFabrica} un). Deseja continuar?`)) {
                return;
            }
        }

        setIsSaving(true);
        try {
            await addStockMovement({
                produto_codigo: selectedProduct.codigo,
                tipo: movementType === 'ENTRADA' ? 'E' : 'S',
                quantidade: qtdNum,
                observacao: observacao.trim() || (movementType === 'ENTRADA' ? 'Entrada Rápida Fábrica' : 'Saída Rápida Fábrica'),
                usuario: user?.NomeCompleto || user?.nome || 'Operador Tablet'
            });

            toast.success(`Movimentação de ${movementType} (${qtdNum} ${selectedProduct.unidade || 'un'}) gravada com sucesso!`);

            // Atualiza saldo local
            const bal = await getStockBalance(selectedProduct.codigo);
            setStockBalances({
                saldoFabrica: parseFloat(bal.saldoFabrica || 0),
                saldoProtheus: parseFloat(bal.saldoProtheus || 0)
            });

            // Atualiza histórico
            const movs = await getStockMovements(selectedProduct.codigo);
            setRecentMovements(movs || []);

            // Reseta campos de entrada
            setQuantidade('');
            setObservacao('');
        } catch (err) {
            console.error('Erro ao salvar movimentação:', err);
            toast.error(err.response?.data?.error || 'Erro ao registrar movimentação.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-3 sm:p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in pb-32 w-full">
            
            {/* 1. Header Estilo Tablet Industrial */}
            <div className="bg-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-2xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-2xl -ml-20 -mb-20"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                                <Factory size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                                    Controle de Estoque • Chão de Fábrica
                                </h2>
                                <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                                    Apontamento rápido de inventário físico, sobras e empenho para ordens de produção.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex items-center gap-2.5 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 backdrop-blur-md">
                            <User className="text-slate-400 shrink-0" size={18} />
                            <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Operador</span>
                                <span className="font-bold text-white text-xs sm:text-sm">{user?.NomeCompleto || user?.nome || 'Operador Local'}</span>
                            </div>
                        </div>

                        {onNavigateCatalog && (
                            <button
                                onClick={onNavigateCatalog}
                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
                            >
                                <Layers size={15} />
                                <span>Ver Catálogo Completo</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Seletor Vibrante de Entrada / Saída */}
                <div className="relative z-10 grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={() => setMovementType('ENTRADA')}
                        className={`py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                            movementType === 'ENTRADA'
                                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white ring-4 ring-emerald-500/20 scale-[1.01]'
                                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <ArrowDownLeft size={22} className={movementType === 'ENTRADA' ? 'text-white' : 'text-emerald-400'} />
                        <span>ENTRADA DE ESTOQUE (+)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMovementType('SAIDA')}
                        className={`py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                            movementType === 'SAIDA'
                                ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white ring-4 ring-rose-500/20 scale-[1.01]'
                                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    >
                        <ArrowUpRight size={22} className={movementType === 'SAIDA' ? 'text-white' : 'text-rose-400'} />
                        <span>SAÍDA / EMPENHO (-)</span>
                    </button>
                </div>
            </div>

            {/* 2. Campo de Busca Rápida (Barcode / Teclado) */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="relative">
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                        placeholder="DIGITE OU LEIA O CÓDIGO DO PRODUTO (ex: MT4-11218, MT2-3277)..."
                        className="w-full text-base sm:text-xl font-black text-slate-900 placeholder-slate-400 border-2 border-slate-200 rounded-2xl py-3.5 sm:py-4 pl-4 sm:pl-6 pr-14 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 sm:p-3 rounded-xl shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                    </button>
                </form>

                {/* Dropdown / Grid de Resultados da Busca */}
                {searchResults.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                        {searchResults.map((p, i) => (
                            <div
                                key={`${p.codigo}-${i}`}
                                onClick={() => handleSelectProduct(p)}
                                className="p-3 bg-white hover:bg-indigo-50/70 rounded-xl border border-slate-200 hover:border-indigo-300 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs"
                            >
                                <div className="min-w-0">
                                    <span className="font-mono font-bold text-slate-900 text-sm block">{p.codigo}</span>
                                    <span className="text-xs text-slate-500 truncate block">{p.descricao}</span>
                                </div>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0 border border-emerald-100">
                                    Fáb: {p.saldo_fabrica || 0}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Painel Principal do Produto Selecionado */}
            {selectedProduct ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Cartão de Detalhes & Saldos (Col 5) */}
                    <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5">
                        
                        <div className="flex items-start gap-4">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                {selectedProduct.imagem_url ? (
                                    <img src={selectedProduct.imagem_url} alt={selectedProduct.codigo} className="w-full h-full object-cover" />
                                ) : (
                                    <Box size={32} className="text-slate-300" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">Produto Selecionado</span>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-mono leading-tight">{selectedProduct.codigo}</h3>
                                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">{selectedProduct.descricao}</p>
                                
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                        UN: {selectedProduct.unidade || 'UN'}
                                    </span>
                                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                        Tipo: {selectedProduct.tipo || 'PA'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Indicadores de Saldo */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Saldo Fábrica</span>
                                <span className="text-2xl font-black text-emerald-700">
                                    {loadingBalance ? '...' : stockBalances.saldoFabrica}
                                </span>
                                <span className="text-xs text-emerald-600 ml-1 font-bold">{selectedProduct.unidade || 'un'}</span>
                            </div>

                            <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200">
                                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">Saldo do Sistema (SINCO)</span>
                                <span className="text-2xl font-black text-blue-700">
                                    {loadingBalance ? '...' : stockBalances.saldoProtheus}
                                </span>
                                <span className="text-xs text-blue-600 ml-1 font-bold">{selectedProduct.unidade || 'un'}</span>
                            </div>
                        </div>

                        {/* Botão Especial de Empenho para OP */}
                        {stockBalances.saldoFabrica > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsEmpenhoModalOpen(true)}
                                className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs sm:text-sm rounded-xl border-2 border-indigo-200 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                            >
                                <Zap size={16} className="text-indigo-600" />
                                <span>EMPENHAR ESTE SALDO PARA UMA OP / PEDIDO</span>
                            </button>
                        )}

                        {/* Histórico Recente */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <span className="flex items-center gap-1.5"><History size={14} /> Últimas Movimentações</span>
                                <span>{recentMovements.length} registro(s)</span>
                            </div>

                            {loadingHistory ? (
                                <p className="text-xs text-slate-400 text-center py-2">Carregando histórico...</p>
                            ) : recentMovements.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-2">Sem movimentações recentes registradas.</p>
                            ) : (
                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                    {recentMovements.slice(0, 5).map((m, idx) => (
                                        <div key={idx} className="p-2 rounded-lg bg-slate-50 text-xs flex justify-between items-center border border-slate-100">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${m.tipo === 'E' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                    {m.tipo === 'E' ? '+ Ent' : '- Saí'}
                                                </span>
                                                <span className="font-bold text-slate-700">{m.quantidade} un</span>
                                            </div>
                                            <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={m.observacao}>
                                                {m.observacao || m.usuario || '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Formulário Touch / Teclado Numérico de Lançamento (Col 7) */}
                    <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5">
                        
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${movementType === 'ENTRADA' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                Lançamento de {movementType === 'ENTRADA' ? 'Entrada' : 'Saída'}
                            </span>

                            {/* Prévia do Novo Saldo */}
                            {qtdNum > 0 && (
                                <span className="text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                                    Novo Saldo Estimado: <b className="text-indigo-600 font-mono">{novoSaldoEstimado} {selectedProduct.unidade || 'un'}</b>
                                </span>
                            )}
                        </div>

                        {/* Input de Quantidade Gigante */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                Quantidade a {movementType === 'ENTRADA' ? 'Adicionar' : 'Retirar'}:
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={quantidade}
                                    onChange={(e) => setQuantidade(e.target.value)}
                                    placeholder="0"
                                    className={`w-full text-3xl sm:text-4xl font-black text-center py-4 px-6 rounded-2xl border-2 outline-none transition-all ${
                                        movementType === 'ENTRADA'
                                            ? 'border-emerald-300 focus:border-emerald-500 text-emerald-950 focus:ring-4 focus:ring-emerald-100 bg-emerald-50/20'
                                            : 'border-rose-300 focus:border-rose-500 text-rose-950 focus:ring-4 focus:ring-rose-100 bg-rose-50/20'
                                    }`}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                                    {selectedProduct.unidade || 'UN'}
                                </span>
                            </div>
                        </div>

                        {/* Teclado Rápido de Incremento (+1, +2, +5, +10, +20, +50, +100) */}
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {[1, 2, 5, 10, 20, 50, 100].map((inc) => (
                                <button
                                    key={inc}
                                    type="button"
                                    onClick={() => handleAddQuantity(inc)}
                                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-black text-xs transition-colors shadow-2xs"
                                >
                                    +{inc}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setQuantidade('')}
                                className="text-xs text-slate-400 hover:text-red-500 font-bold transition-colors"
                            >
                                Limpar Quantidade
                            </button>
                        </div>

                        {/* Motivos Rápidos Clicáveis */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                Motivo / Observação Rápida:
                            </label>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {(movementType === 'ENTRADA' ? quickReasonsEntrada : quickReasonsSaida).map((reason, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            if (reason === 'Empenhar para OP Específica') {
                                                setIsEmpenhoModalOpen(true);
                                            } else {
                                                setObservacao(reason);
                                            }
                                        }}
                                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                                            observacao === reason
                                                ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                placeholder="Ou digite um motivo personalizado..."
                                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        {/* Botão Gigante de Confirmação */}
                        <button
                            type="button"
                            onClick={handleSaveMovement}
                            disabled={isSaving || qtdNum <= 0}
                            className={`w-full py-4 px-6 rounded-2xl text-white font-black text-base sm:text-lg shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                movementType === 'ENTRADA'
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-emerald-600/30'
                                    : 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 shadow-rose-600/30'
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={24} className="animate-spin" />
                                    <span>Gravando Movimentação...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={24} />
                                    <span>
                                        CONFIRMAR {movementType === 'ENTRADA' ? 'ENTRADA' : 'SAÍDA'} ({qtdNum} {selectedProduct.unidade || 'un'})
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                    <Box size={48} className="text-slate-300 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-slate-700">Nenhum Produto Selecionado</h4>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md mx-auto">
                        Utilize a barra de busca acima para ler o código de barras ou digitar o código/descrição do item.
                    </p>
                </div>
            )}

            {/* Modal de Empenho Direto para OP */}
            {isEmpenhoModalOpen && selectedProduct && (
                <StockEmpenhoModal
                    product={{
                        ...selectedProduct,
                        saldo_fabrica: stockBalances.saldoFabrica,
                        saldo_protheus: stockBalances.saldoProtheus
                    }}
                    onClose={() => setIsEmpenhoModalOpen(false)}
                    onSuccess={() => {
                        setIsEmpenhoModalOpen(false);
                        handleSelectProduct(selectedProduct);
                    }}
                />
            )}
        </div>
    );
}
