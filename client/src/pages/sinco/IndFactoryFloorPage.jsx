import React, { useState, useEffect } from 'react';
import { Factory, Search, RefreshCcw, Loader2, PlayCircle, Clock } from 'lucide-react';
import api from '../../services/api';

const IndFactoryFloorPage = () => {
    const [lotes, setLotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLotes = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/ind_pcp/active-lotes');
            if (data.success) {
                setLotes(data.data);
            }
        } catch (error) {
            console.error('Erro ao buscar lotes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLotes();
    }, []);

    const filteredLotes = lotes.filter(lote => 
        lote.op_fracionada.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.produto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status) => {
        switch(status?.toUpperCase()) {
            case 'LIBERADO': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'EM_PRODUCAO': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'FINALIZADO': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Factory className="text-emerald-600 h-6 w-6" />
                        Apontamento Ativo (Local)
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Painel independente. Aqui vivem os lotes que saíram do PCP e estão fisicamente na fábrica.
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por lote ou produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                
                <button 
                    onClick={fetchLotes}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
                >
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar Grade
                </button>
            </div>

            {/* Kanban / Cards */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-4" />
                    <p className="text-slate-500">Carregando lotes da fábrica...</p>
                </div>
            ) : filteredLotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
                    <p>Nenhum lote ativo na fábrica correspondente aos filtros.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredLotes.map(lote => (
                        <div key={lote.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 tracking-tight font-mono">
                                        {lote.op_fracionada}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Mãe: {lote.op_base}</p>
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border ${getStatusColor(lote.status)}`}>
                                    {lote.status}
                                </span>
                            </div>

                            <div className="space-y-1 mb-5">
                                <p className="text-sm font-medium text-slate-700">{lote.produto}</p>
                                <p className="text-xs text-slate-500 line-clamp-2">{lote.descricao}</p>
                            </div>

                            <div className="flex items-end justify-between border-t border-slate-100 pt-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Lote (UN)</p>
                                    <p className="text-xl font-bold text-emerald-600">{parseFloat(lote.quantidade_lote)}</p>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors" title="Ver Operações">
                                        <Clock className="h-4 w-4" />
                                    </button>
                                    <button className="flex items-center gap-1.5 px-3 h-8 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors">
                                        <PlayCircle className="h-3.5 w-3.5" />
                                        Início
                                    </button>
                                </div>
                            </div>
                            
                            {/* Accent Line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IndFactoryFloorPage;
