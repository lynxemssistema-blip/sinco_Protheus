import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, User, Calendar, FileText, ArrowRight, Maximize2, Minimize2, ChevronDown, ChevronUp, History } from 'lucide-react';
import { getPlanningAudit, getPlanningHistory } from '../services/api';

export default function PlanningAuditPanel() {
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [rowHistory, setRowHistory] = useState({});
    const [loadingHistory, setLoadingHistory] = useState({});
    
    // Default to last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const [filters, setFilters] = useState({
        usuario: '',
        op: '',
        pedido: '',
        data_inicio: sevenDaysAgo.toISOString().split('T')[0],
        data_fim: today.toISOString().split('T')[0]
    });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getPlanningAudit(filters);
            setAuditLogs(data || []);
        } catch (error) {
            console.error('Erro ao buscar auditoria:', error);
            alert('Falha ao carregar auditoria de planejamento.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setExpandedRow(null);
        fetchLogs();
    };

    const toggleRow = async (log) => {
        if (expandedRow === log.id) {
            setExpandedRow(null);
            return;
        }
        
        setExpandedRow(log.id);
        const rec = log.recurso_code || log.operacao_codigo || 'GERAL';
        const cacheKey = `${log.op_numero}_${rec}`;
        
        if (!rowHistory[cacheKey]) {
            setLoadingHistory(prev => ({ ...prev, [cacheKey]: true }));
            try {
                const data = await getPlanningHistory(log.op_numero);
                setRowHistory(prev => ({ ...prev, [cacheKey]: data[rec] || [] }));
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingHistory(prev => ({ ...prev, [cacheKey]: false }));
            }
        }
    };

    return (
        <div className={`bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'rounded-xl h-[calc(100vh-250px)]'}`}>
            {/* Toolbar / Filters */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex flex-wrap justify-between items-end gap-4">
                <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Usuário</label>
                        <input 
                            type="text" 
                            name="usuario"
                            placeholder="Nome do usuário..."
                            value={filters.usuario}
                            onChange={handleFilterChange}
                            className="border rounded p-2 text-sm w-48"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nº OP</label>
                        <input 
                            type="text" 
                            name="op"
                            placeholder="Ex: 012345"
                            value={filters.op}
                            onChange={handleFilterChange}
                            className="border rounded p-2 text-sm w-28"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Pedido</label>
                        <input 
                            type="text" 
                            name="pedido"
                            placeholder="Ex: 123456"
                            value={filters.pedido}
                            onChange={handleFilterChange}
                            className="border rounded p-2 text-sm w-28"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Data Início</label>
                        <input 
                            type="date" 
                            name="data_inicio"
                            value={filters.data_inicio}
                            onChange={handleFilterChange}
                            className="border rounded p-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Data Fim</label>
                        <input 
                            type="date" 
                            name="data_fim"
                            value={filters.data_fim}
                            onChange={handleFilterChange}
                            className="border rounded p-2 text-sm"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-blue-600 text-white rounded p-2 px-4 font-bold hover:bg-blue-700 flex items-center gap-2 text-sm h-[38px]"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Filtrar
                    </button>
                </form>
                <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-600 transition-colors h-[38px] flex items-center justify-center gap-2"
                    title={isFullscreen ? "Sair da Tela Inteira" : "Ver em Tela Inteira"}
                >
                    {isFullscreen ? (
                        <><Minimize2 className="w-4 h-4" /> <span className="text-sm font-semibold">Minimizar</span></>
                    ) : (
                        <><Maximize2 className="w-4 h-4" /> <span className="text-sm font-semibold">Tela Inteira</span></>
                    )}
                </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
                {loading && auditLogs.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-slate-500 flex-col gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <p>Carregando registros de auditoria...</p>
                    </div>
                ) : auditLogs.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-slate-500">
                        Nenhum registro de planejamento encontrado para os filtros selecionados.
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto shadow-sm max-w-full">
                        <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase text-xs">
                                    <th className="p-3">Data/Hora</th>
                                    <th className="p-3">Usuário</th>
                                    <th className="p-3">OP (Seq)</th>
                                    <th className="p-3">Pedido</th>
                                    <th className="p-3">Recurso/Operação</th>
                                    <th className="p-3 text-center">Revisão</th>
                                    <th className="p-3">Período Planejado</th>
                                    <th className="p-3">Justificativa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map((log) => {
                                    const rec = log.recurso_code || log.operacao_codigo || 'GERAL';
                                    const cacheKey = `${log.op_numero}_${rec}`;
                                    const isExpanded = expandedRow === log.id;
                                    const historyData = rowHistory[cacheKey] || [];
                                    const isHistoryLoading = loadingHistory[cacheKey];

                                    return (
                                    <React.Fragment key={log.id}>
                                        <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-3 whitespace-nowrap text-slate-600">
                                                {new Date(log.criado_em).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="p-3 whitespace-nowrap font-semibold text-blue-700">
                                                {log.usuario_planejador}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <div className="font-bold text-slate-800">{log.op_numero}</div>
                                                <div className="text-xs text-slate-500">Seq: {log.op_sequencia}</div>
                                            </td>
                                            <td className="p-3 whitespace-nowrap text-slate-700 font-mono text-sm font-semibold">
                                                {log.pedido_venda || '-'}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <div className="font-semibold text-slate-800">{log.recurso_code || log.operacao_codigo}</div>
                                                {log.recurso_desc && <div className="text-xs text-slate-500">{log.recurso_desc}</div>}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => toggleRow(log)}
                                                    className="flex items-center justify-center gap-1 mx-auto bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold px-2 py-1 rounded text-xs transition-colors"
                                                    title="Ver histórico desta operação"
                                                >
                                                    Rev {log.revisao}
                                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1 text-slate-700">
                                                    <span>{new Date(log.data_inicio).toLocaleDateString('pt-BR')}</span>
                                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                                    <span>{new Date(log.data_fim).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {log.observacao ? (
                                                    <div className="text-amber-900 bg-amber-50 p-2 rounded text-xs border border-amber-100">
                                                        "{log.observacao}"
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">Sem justificativa</span>
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <td colSpan="8" className="p-4 px-8">
                                                    <div className="bg-white rounded border border-purple-200 shadow-inner p-4">
                                                        <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                                            <History className="w-4 h-4 text-purple-600" />
                                                            Histórico de Planejamento (OP: {log.op_numero} - Recurso: {rec})
                                                        </h4>
                                                        
                                                        {isHistoryLoading ? (
                                                            <div className="flex justify-center p-4">
                                                                <RefreshCw className="w-5 h-5 text-purple-500 animate-spin" />
                                                            </div>
                                                        ) : historyData.length === 0 ? (
                                                            <p className="text-sm text-slate-500">Nenhum histórico encontrado.</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {historyData.map(h => (
                                                                    <div key={h.id} className={`flex flex-wrap items-center justify-between p-3 rounded border text-sm ${h.id === log.id ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={`font-bold px-2 py-0.5 rounded text-xs ${h.id === log.id ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                                                                Rev {h.revisao}
                                                                            </span>
                                                                            <span className="text-slate-600 font-medium w-32">{new Date(h.criado_em).toLocaleString('pt-BR')}</span>
                                                                            <span className="text-blue-700 font-semibold w-24 truncate">{h.usuario_planejador}</span>
                                                                            <div className="flex items-center gap-1 bg-white px-2 py-1 border border-slate-200 rounded">
                                                                                <span className="text-slate-800">{new Date(h.data_inicio).toLocaleDateString('pt-BR')}</span>
                                                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                                <span className="text-slate-800">{new Date(h.data_fim).toLocaleDateString('pt-BR')}</span>
                                                                            </div>
                                                                        </div>
                                                                        {h.observacao && (
                                                                            <div className="text-amber-900 bg-amber-50 px-2 py-1 rounded text-xs border border-amber-100 flex-1 ml-4 max-w-md truncate" title={h.observacao}>
                                                                                "{h.observacao}"
                                                                            </div>
                                                                        )}
                                                                        {h.id === log.id && <span className="text-xs font-bold text-purple-600 ml-2">(Atual na tabela)</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
