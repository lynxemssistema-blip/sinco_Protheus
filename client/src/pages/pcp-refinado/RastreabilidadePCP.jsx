import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, Package, Target, History, Factory, AlertTriangle, CheckCircle, Clock, Sparkles, Loader2, Network, ShoppingCart, FileText, X } from 'lucide-react';
import api, { getFileUrl } from '../../services/api';
import { useFilters } from '../../contexts/FilterContext';
import OrderFiltersBar from '../../components/orders/OrderFiltersBar';

const RastreabilidadePCP = () => {
    // Mockup Data for demonstrating the concept
    

    
    const [dados, setDados] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const { orderFilters, updateOrderFilters } = useFilters();

    const filters = useMemo(() => ({
        cliente: orderFilters.cliente || '',
        pedido: orderFilters.pedido || '',
        produto: orderFilters.produto || '',
        dataInicial: orderFilters.dataInicial || '',
        dataFinal: orderFilters.dataFinal || '',
        dateType: orderFilters.dateType || 'pedido',
        tipo_item: orderFilters.tipo_item || '',
        only_active: orderFilters.only_active || 'true'
    }), [orderFilters]);

    const handleFilterChange = useCallback((e) => {
        const { name, value } = e.target;
        updateOrderFilters({ [name]: value });
    }, [updateOrderFilters]);

    const [expandedPedidos, setExpandedPedidos] = useState({});
    const [expandedItens, setExpandedItens] = useState({ '100450-01': true });
    const [expandedOps, setExpandedOps] = useState({ '00010001001': true, '00010002001': true });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/pcp-refinado/rastreabilidade', { params: filters });
                const data = response.data;
                setDados(data);
                if (data.length > 0) {
                    setExpandedPedidos({ [data[0].pedido]: true });
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.only_active]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

    const filteredDados = dados;
    
    // AI State
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [aiStrategy, setAiStrategy] = useState(null);
    const [aiError, setAiError] = useState(null);

    const generateAiStrategy = async (pedidoData) => {
        setIsGeneratingAi(true);
        setAiStrategy(null);
        setAiError(null);
        try {
            const response = await api.post('/ai/manufacturing-strategy', { orderData: pedidoData });
            setAiStrategy(response.data.strategy);
        } catch (error) {
            console.error(error);
            setAiError('Ocorreu um erro ao conectar com o Agente de IA. Tente novamente.');
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const toggle = (setter, key, e) => {
        if (e) e.stopPropagation();
        setter(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const getStatusIcon = (status) => {
        if (status === 'success') return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        if (status === 'warning') return <Clock className="w-5 h-5 text-amber-500" />;
        if (status === 'danger') return <AlertTriangle className="w-5 h-5 text-red-500" />;
        return null;
    };

    const getOpStatusColor = (status) => {
        if (status === 'concluido') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (status === 'andamento') return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-slate-100 text-slate-500 border-slate-200';
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <OrderFiltersBar
                    filters={filters}
                    viewMode="tree"
                    loading={isLoading}
                    onFilterChange={handleFilterChange}
                    onSearch={handleSearch}
                    onViewModeChange={() => {}}
                    onDownloadExcel={() => {}}
                    onDownloadPDF={() => {}}
                    onOpenReport={() => {}}
                />
            </div>

            <div className="space-y-4">
                {isLoading ? (<div className="p-8 text-center text-slate-500 flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />Carregando Rastreabilidade...</div>) : filteredDados.map(pedido => (
                    <div key={pedido.pedido} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Header do Pedido */}
                        <div 
                            className="bg-indigo-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-indigo-100 transition-colors"
                            onClick={() => toggle(setExpandedPedidos, pedido.pedido)}
                        >
                            <div className="flex items-center gap-4">
                                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                                <div>
                                    <span className="font-bold text-slate-800 mr-2">Pedido: {pedido.pedido}</span>
                                    <span className="text-sm text-slate-600 border-l border-indigo-200 pl-2">{pedido.cliente}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium text-slate-600 bg-white px-2 py-1 rounded shadow-sm">
                                    Entrega Comercial: <strong className={pedido.data_entrega === '15/07/2026' ? 'text-red-500' : 'text-slate-700'}>{pedido.data_entrega}</strong>
                                </span>
                                {expandedPedidos[pedido.pedido] ? <ChevronDown className="w-5 h-5 text-indigo-400" /> : <ChevronRight className="w-5 h-5 text-indigo-400" />}
                            </div>
                        </div>

                        {/* Corpo do Pedido (Itens) */}
                        {expandedPedidos[pedido.pedido] && (
                            <div className="p-4 bg-slate-50 border-t border-indigo-100">
                                <div className="space-y-4">
                                    {pedido.itens.map(item => {
                                        const itemKey = `${pedido.pedido}-${item.item}`;
                                        
                                        // Calcular resumo de tempo previsto
                                        const timeSummary = {};
                                        const extractTimes = (opsArray) => {
                                            if (!opsArray) return;
                                            opsArray.forEach(op => {
                                                if (op.operacoes) {
                                                    op.operacoes.forEach(oper => {
                                                        const key = oper.recurso;
                                                        if (!timeSummary[key]) {
                                                            timeSummary[key] = { recurso: oper.recurso, tempo: 0 };
                                                        }
                                                        timeSummary[key].tempo += (oper.tempo_previsto || 0);
                                                    });
                                                }
                                                if (op.ops_filhas && op.ops_filhas.length > 0) {
                                                    extractTimes(op.ops_filhas);
                                                }
                                            });
                                        };
                                        extractTimes(item.ops);
                                        const timeSummaryArray = Object.values(timeSummary).sort((a,b) => b.tempo - a.tempo);

                                        return (
                                            <div key={itemKey} className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                                                {/* Header do Item */}
                                                <div 
                                                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 border-b border-slate-100"
                                                    onClick={(e) => toggle(setExpandedItens, itemKey, e)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Package className="w-5 h-5 text-slate-400" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold text-slate-700">{item.produto}</span>
                                                                {item.primeiro_arquivo && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.primeiro_arquivo)}`), '_blank'); }}
                                                                        className="hover:bg-red-50 p-0.5 rounded transition-colors"
                                                                        title="Abrir Desenho/PDF"
                                                                    >
                                                                        <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                                    </button>
                                                                )}
                                                                <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600">Item {item.item}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 uppercase">{item.descricao}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-6">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); generateAiStrategy(item); }}
                                                            className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-lg text-sm shadow-sm transition-all active:scale-95"
                                                            disabled={isGeneratingAi}
                                                        >
                                                            {isGeneratingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                            Estratégia IA
                                                        </button>

                                                        <div className="flex gap-4 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                                            <div className="text-right">
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Faturado</div>
                                                                <div className="font-bold text-slate-800 text-sm">{item.qtd_faturada} / {item.qtd_vendida}</div>
                                                            </div>
                                                            <div className="text-right border-l pl-3 border-slate-200">
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">A Faturar</div>
                                                                <div className="font-bold text-amber-600 text-sm">{item.qtd_a_faturar}</div>
                                                            </div>
                                                            <div className="text-right border-l pl-3 border-slate-200">
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Evolução</div>
                                                                <div className={`font-bold text-sm ${item.percentual_evolucao == 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{item.percentual_evolucao}%</div>
                                                            </div>
                                                            <div className="text-right border-l pl-3 border-slate-200">
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Estoque</div>
                                                                <div className={`font-bold text-sm ${item.qtd_estoque >= item.qtd_vendida ? 'text-emerald-600' : 'text-slate-700'}`}>{item.qtd_estoque}</div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                                                            item.status_global === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
                                                            item.status_global === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 
                                                            'bg-red-50 border-red-200 text-red-800'
                                                        }`}>
                                                            {getStatusIcon(item.status_global)}
                                                            <span className="text-sm font-bold">{item.mensagem}</span>
                                                        </div>

                                                        {expandedItens[itemKey] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                                    </div>
                                                </div>

                                                {/* Detalhe da Produção do Item (OPs) */}
                                                {expandedItens[itemKey] && item.ops.length > 0 && (
                                                    <div className="p-4 bg-slate-50">
                                                        
                                                        {/* Resumo de Tempo Previsto */}
                                                        {timeSummaryArray.length > 0 && (
                                                            <div className="mb-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                                    <Clock className="w-4 h-4" /> Tempo Previsto Total (Todos Níveis)
                                                                </h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {timeSummaryArray.map(ts => (
                                                                        <div key={ts.recurso} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded text-xs text-indigo-800">
                                                                            <span className="font-bold">{ts.recurso}:</span>
                                                                            <span>{ts.tempo.toFixed(1)} min</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                                            <Factory className="w-4 h-4" /> Árvore de Produção (Rastreio)
                                                        </h4>
                                                        
                                                        {item.ops.map(opPai => (
                                                            <div key={opPai.op} className="space-y-4">
                                                                {/* OP Pai */}
                                                                <div className="border border-slate-200 bg-white rounded-lg shadow-sm overflow-hidden">
                                                                    <div className="flex justify-between items-center p-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer" onClick={(e) => toggle(setExpandedOps, opPai.op, e)}>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider">OP PAI (Nível 0)</span>
                                                                            <span className="font-mono font-bold text-slate-800 text-sm">{opPai.op}</span>
                                                                            <span className="font-mono text-sm text-slate-600 bg-slate-200/50 px-2 rounded">{opPai.produto}</span>
                                                                            {opPai.primeiro_arquivo && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(opPai.primeiro_arquivo)}`), '_blank'); }}
                                                                                    className="hover:bg-red-50 p-1 rounded transition-colors"
                                                                                    title="Abrir Desenho/PDF"
                                                                                >
                                                                                    <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                                                </button>
                                                                            )}
                                                                            <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                                <span>Produção:</span>
                                                                                <span className={opPai.qtd_feita >= opPai.qtd_op ? 'text-emerald-600 font-bold' : 'text-slate-700'}>{opPai.qtd_feita}</span>
                                                                                <span>/ {opPai.qtd_op} pçs</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className={`text-xs font-bold px-2 py-1 rounded ${opPai.qtd_feita >= opPai.qtd_op ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                                            {opPai.status_op}
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {expandedOps[opPai.op] !== false && (
                                                                        <div className="p-3 bg-white">
                                                                            {/* Operações da OP Pai */}
                                                                            <div className="flex gap-2 flex-wrap mb-2">
                                                                                {opPai.operacoes.map(oper => (
                                                                                    <div key={oper.op_seq} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 border rounded-md shadow-sm ${getOpStatusColor(oper.status)}`}>
                                                                                        <Target className="w-3.5 h-3.5" />
                                                                                        <span className="font-bold">{oper.op_seq} - {oper.recurso}</span>
                                                                                        <span className="bg-white/60 px-1.5 rounded border border-white/40 font-medium">Feito: {oper.qtd_apontada}/{oper.qtd_total}</span>
                                                                                        {oper.planejamento_inicio && (
                                                                                            <span className="text-[10px] bg-white/40 px-1.5 rounded ml-1 font-medium border border-white/40">
                                                                                                Plan: {new Date(oper.planejamento_inicio).toLocaleDateString('pt-BR')}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>

                                                                            {/* OPs Filhas */}
                                                                            {opPai.ops_filhas && opPai.ops_filhas.length > 0 && (
                                                                                <div className="mt-4 pl-6 border-l-2 border-slate-200 space-y-3 relative before:absolute before:top-0 before:left-[-2px] before:w-0.5 before:h-full before:bg-slate-200">
                                                                                    {opPai.ops_filhas.map((opFilha, idx) => (
                                                                                        <div key={opFilha.op} className="relative">
                                                                                            <div className="absolute w-4 h-0.5 bg-slate-200 left-[-24px] top-[20px]"></div>
                                                                                            <div className="border border-slate-200 bg-slate-50/50 rounded-lg overflow-hidden shadow-sm transition-all hover:border-slate-300">
                                                                                                <div className="flex justify-between items-center p-2.5 cursor-pointer hover:bg-slate-100/80" onClick={(e) => toggle(setExpandedOps, opFilha.op, e)}>
                                                                                                    <div className="flex items-center gap-3">
                                                                                                        <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded tracking-wider">Nível 1</span>
                                                                                                        <span className="font-mono font-bold text-slate-700 text-sm">{opFilha.op}</span>
                                                                                                        <span className="font-mono text-sm text-slate-600 bg-white px-2 rounded border border-slate-200">{opFilha.produto}</span>
                                                                                                        {opFilha.primeiro_arquivo && (
                                                                                                            <button
                                                                                                                onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(opFilha.primeiro_arquivo)}`), '_blank'); }}
                                                                                                                className="hover:bg-red-50 p-1 rounded transition-colors"
                                                                                                                title="Abrir Desenho/PDF"
                                                                                                            >
                                                                                                                <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                                                                            </button>
                                                                                                        )}
                                                                                                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                                                                            <span>Produção:</span>
                                                                                                            <span className={opFilha.qtd_feita >= opFilha.qtd_op ? 'text-emerald-600 font-bold' : 'text-slate-700'}>{opFilha.qtd_feita}</span>
                                                                                                            <span>/ {opFilha.qtd_op} pçs</span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className={`text-xs font-bold px-2 py-1 rounded ${opFilha.qtd_feita >= opFilha.qtd_op ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                                                                                        {opFilha.status_op}
                                                                                                    </div>
                                                                                                </div>
                                                                                                
                                                                                                {expandedOps[opFilha.op] !== false && (
                                                                                                    <div className="p-3 bg-white border-t border-slate-100">
                                                                                                        <div className="flex gap-2 flex-wrap">
                                                                                                            {opFilha.operacoes.map(oper => (
                                                                                                                <div key={oper.op_seq} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 border rounded-md shadow-sm ${getOpStatusColor(oper.status)}`}>
                                                                                                                    <Target className="w-3 h-3" />
                                                                                                                    <span className="font-bold">{oper.op_seq} - {oper.recurso}</span>
                                                                                                                    <span className="bg-white/60 px-1.5 rounded border border-white/40 font-medium">Feito: {oper.qtd_apontada}/{oper.qtd_total}</span>
                                                                                                                    {oper.planejamento_inicio && (
                                                                                                                        <span className="text-[10px] bg-white/40 px-1.5 rounded ml-1 font-medium border border-white/40">
                                                                                                                            Plan: {new Date(oper.planejamento_inicio).toLocaleDateString('pt-BR')}
                                                                                                                        </span>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal da Estratégia de IA */}
            {(aiStrategy || isGeneratingAi || aiError) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-indigo-100">
                        <div className="px-6 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                                {isGeneratingAi ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> : <Sparkles className="w-6 h-6 text-indigo-600" />}
                                Estratégia do Diretor Industrial (IA)
                            </h3>
                            {!isGeneratingAi && (
                                <button 
                                    onClick={() => { setAiStrategy(null); setAiError(null); }}
                                    className="p-2 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            )}
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                            {isGeneratingAi ? (
                                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
                                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                    <p className="text-indigo-700 font-medium">O Agente Gemini 1.5 Pro está analisando a estrutura de produção e o planejamento...</p>
                                </div>
                            ) : aiError ? (
                                <div className="text-red-600 bg-red-50 p-4 rounded-xl border border-red-200 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold mb-1">Erro de Conexão</h4>
                                        <p>{aiError}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="prose prose-sm prose-indigo max-w-none text-slate-700 font-sans bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    {aiStrategy ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {aiStrategy}
                                        </ReactMarkdown>
                                    ) : (
                                        <div className="text-slate-500 italic">Nenhuma estratégia foi gerada pela IA.</div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {!isGeneratingAi && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                                <button 
                                    onClick={() => { setAiStrategy(null); setAiError(null); }}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                                >
                                    Fechar Diagnóstico
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RastreabilidadePCP;
