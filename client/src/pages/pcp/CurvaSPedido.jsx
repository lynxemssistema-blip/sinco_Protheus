import React, { useState, useEffect } from 'react';
import { Search, Loader2, TrendingUp, AlertTriangle, CheckCircle2, Package, Calendar, Filter } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

export default function CurvaSPedido({ filters }) {
    const [pedido, setPedido] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const isEmbedded = !!filters;

    const fetchData = async (fetchFilters) => {
        setLoading(true);
        setError(null);
        try {
            const params = { ...fetchFilters };
            Object.keys(params).forEach(key => {
                if (params[key] === '' || (Array.isArray(params[key]) && params[key].length === 0) || params[key] === 'TODOS') {
                    delete params[key];
                }
            });
            const res = await api.get('/pcp/curva-s', { params });
            setData(res.data);
        } catch (err) {
            setError('Falha ao buscar dados para a Curva S. Verifique os filtros.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isEmbedded) {
            // Only fetch if at least one meaningful filter is provided
            if (!filters.pedido && !filters.op && !filters.produto && !filters.cliente && !filters.setor && !filters.operacao) {
                setData(null);
                return;
            }
            fetchData(filters);
        }
    }, [filters, isEmbedded]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!pedido.trim()) return;
        fetchData({ pedido: pedido.trim() });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '--/--/----';
        // handle Protheus format YYYYMMDD
        if (dateString.length === 8 && !dateString.includes('-')) {
            return `${dateString.slice(6, 8)}/${dateString.slice(4, 6)}/${dateString.slice(0, 4)}`;
        }
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const renderContent = () => (
        <div className={`flex-1 overflow-auto ${isEmbedded ? 'pt-4' : 'p-8'} relative`}>
            
            {!isEmbedded && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 w-full max-w-3xl flex gap-3 mx-auto">
                    <form onSubmit={handleSearch} className="flex-1 flex gap-3">
                        <input 
                            type="text"
                            placeholder="Digite o número do Pedido de Venda (ex: 4249)"
                            value={pedido}
                            onChange={(e) => setPedido(e.target.value)}
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg"
                        />
                        <button
                            type="submit"
                            disabled={loading || !pedido.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold px-8 rounded-xl transition-colors flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            Buscar Curva
                        </button>
                    </form>
                </div>
            )}

            {error && (
                <div className="max-w-3xl mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            {data && data.curva && data.curva.length > 0 && (
                <div className={`${isEmbedded ? 'w-full' : 'max-w-6xl mx-auto'} space-y-6`}>
                    
                    {data.pedido_info && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-6 items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium">Qtde Total do Pedido</div>
                                    <div className="text-lg font-bold text-slate-800">{Number(data.pedido_info.total_pecas).toLocaleString('pt-BR')} peças</div>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium">Data de Emissão</div>
                                    <div className="text-sm font-bold text-slate-700">{formatDate(data.pedido_info.data_emissao)}</div>
                                </div>
                            </div>
                            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 font-medium">Data de Entrega</div>
                                    <div className="text-sm font-bold text-slate-700">{formatDate(data.pedido_info.data_entrega)}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="text-slate-500 text-sm font-semibold mb-1">Volume Planejado</div>
                            <div className="text-3xl font-black text-slate-700">{Number(data.meta_total_planejada).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
                            <div className="text-xs text-slate-400 mt-2">Peças/Operações Meta</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="text-slate-500 text-sm font-semibold mb-1">Volume Produzido</div>
                            <div className="text-3xl font-black text-blue-600">{Number(data.meta_total_executada).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</div>
                            <div className="text-xs text-slate-400 mt-2">Peças Apontadas (Real)</div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="text-slate-500 text-sm font-semibold mb-1">Status Atual do Pedido</div>
                            {data.meta_total_executada >= data.meta_total_planejada ? (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle2 className="w-8 h-8" />
                                    <span className="text-2xl font-black">Concluído</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-amber-500">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <span className="text-2xl font-black">Em Andamento</span>
                                </div>
                            )}
                            <div className="text-xs text-slate-400 mt-2 font-mono">{(data.meta_total_executada / (data.meta_total_planejada || 1) * 100).toFixed(1)}% Evolução Total</div>
                        </div>
                    </div>

                    {/* Gráfico */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-6">Gráfico Evolutivo de Apontamento (Curva S)</h2>
                        <div className="h-[500px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <LineChart data={data.curva} margin={{ top: 20, right: 30, left: 30, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="data" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                        label={{ value: 'Evolução no Tempo (Datas)', position: 'insideBottom', offset: -20, fill: '#475569', fontSize: 13, fontWeight: 'bold' }}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                        dx={-10}
                                        label={{ value: 'Qtd. Acumulada', angle: -90, position: 'insideLeft', offset: -15, fill: '#475569', fontSize: 13, fontWeight: 'bold', style: { textAnchor: 'middle' } }}
                                        tickFormatter={(val) => Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        labelStyle={{ fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}
                                        formatter={(value) => [Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 }), 'Quantidade']}
                                    />
                                    <Legend 
                                        iconType="circle" 
                                        wrapperStyle={{ paddingTop: '20px' }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="planejado" 
                                        name="Meta Planejada (Acumulada)" 
                                        stroke="#94a3b8" 
                                        strokeWidth={3}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        activeDot={{ r: 6, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="executado" 
                                        name="Evolução Real (Apontamentos)" 
                                        stroke="#425750" 
                                        strokeWidth={4}
                                        dot={{ r: 4, fill: '#425750', strokeWidth: 0 }}
                                        activeDot={{ r: 8, fill: '#425750', stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            )}
            
            {data && data.opsFound === 0 && (
                <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-16 text-center bg-white rounded-2xl border border-slate-200 mt-8">
                    <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="font-semibold text-slate-600 text-lg">Nenhum dado encontrado</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-md">
                        Não foi possível encontrar OPs ou planejamento para os filtros selecionados.
                    </p>
                </div>
            )}
            
            {isEmbedded && !data && !loading && (
                <div className="max-w-3xl mx-auto flex flex-col items-center justify-center p-16 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl mt-8">
                    <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="font-semibold text-slate-600 text-lg">Utilize os filtros acima</p>
                    <p className="text-sm text-slate-400 mt-1 max-w-md">
                        Pesquise por OP, Pedido ou Produto para carregar a Curva S de evolução.
                    </p>
                </div>
            )}
        </div>
    );

    if (isEmbedded) {
        return (
            <div className="relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                            <span className="text-slate-600 font-semibold">Carregando Curva S...</span>
                        </div>
                    </div>
                )}
                {renderContent()}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
            <div className="flex-shrink-0 px-8 py-5 border-b border-slate-200 bg-white shadow-sm z-10 flex justify-between items-center relative">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-7 h-7 text-blue-600" />
                        Curva S de Produção
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Acompanhamento Planejado vs Realizado
                    </p>
                </div>
            </div>
            {renderContent()}
        </div>
    );
}
