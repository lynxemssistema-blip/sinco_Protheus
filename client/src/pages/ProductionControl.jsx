import React, { useState, useEffect, useRef } from 'react';
import {
    Calendar, Clock, CheckSquare, Search, Filter, AlertTriangle,
    ChevronDown, ChevronRight, MoreHorizontal, AlertOctagon, CheckCircle, List, Printer, FileText, HelpCircle
} from 'lucide-react';


import ProductionHistoryModal from '../components/ProductionHistoryModal';
import ProductionPrint from '../components/ProductionPrint';
import ProductionPlanningModal from '../components/ProductionPlanningModal';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionMacroModal from '../components/ProductionMacroModal';
import ProcessLegendModal from '../components/ProcessLegendModal';
import { getProductionDashboard, saveProductionPlan, saveProductionPlanBatch, saveAppointment, getProductDocuments, getOperationById, getEstruturaProduto, getFileUrl } from '../services/api';
import useStickyState from '../hooks/useStickyState';
import { toast } from 'react-toastify';

// ... (other imports)

export default function ProductionControl() {
    const [ops, setOps] = useState([]);
    const [selectedOpHistory, setSelectedOpHistory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [planningOp, setPlanningOp] = useState(null);
    const [appointingOp, setAppointingOp] = useState(null);
    const [macroModalOp, setMacroModalOp] = useState(null);
    const [macroOperations, setMacroOperations] = useState([]);
    const [showLegend, setShowLegend] = useState(false);
    const [currentPage, setCurrentPage] = useStickyState(1, '@metalfisa:prod_currentPage');
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);
    const [calcType, setCalcType] = useStickyState('op_specific', '@metalfisa:prod_calcType');

    const [filters, setFilters] = useStickyState({
        op: '',
        pedido: '',
        item: '',
        sequencia: '',
        produto: '',
        cliente: '',
        operacao: '',
        status: '',
        pending_delivery: true // Default: Only show items with balance to deliver
    }, '@metalfisa:prod_filters');

    const [sortConfig, setSortConfig] = useStickyState(null, '@metalfisa:prod_sortConfig');
    // Map of cod_produto_op -> { hasDoc: bool, url: string|null }
    const [productDocs, setProductDocs] = useState({});
    const [expandedRows, setExpandedRows] = useState({});
    const [estruturaCache, setEstruturaCache] = useState({});

    const sortOps = (opsToSort) => {
        if (!sortConfig) return opsToSort;

        return [...opsToSort].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const loadData = async (page = currentPage) => {
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente) {
            setOps([]);
            setTotalPages(0);
            setTotal(0);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const params = { ...filters, page, limit: 50 };
            Object.keys(params).forEach(key => {
                if (params[key] === '' || (Array.isArray(params[key]) && params[key].length === 0)) {
                    delete params[key];
                }
            });

            const res = await getProductionDashboard(params);
            setOps(res.data);
            setTotalPages(res.totalPages);
            setTotal(res.total);
            setCurrentPage(page);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Fetch PDF docs for all visible products (background, cached)
    useEffect(() => {
        if (!ops || ops.length === 0) return;
        const uniqueCodes = [...new Set(ops.map(o => o.cod_produto_op).filter(Boolean))];
        const toFetch = uniqueCodes.filter(c => !(c in productDocs));
        if (toFetch.length === 0) return;

        // Mark as loading to avoid duplicate fetches
        setProductDocs(prev => {
            const next = { ...prev };
            toFetch.forEach(c => { if (!(c in next)) next[c] = null; });
            return next;
        });

        toFetch.forEach(async (codigo) => {
            try {
                const docs = await getProductDocuments(codigo);
                const drawing = Array.isArray(docs) ? docs.find(d => d.tipo === 'Desenho' || d.tipo === 'PDF') || docs[0] : null;
                setProductDocs(prev => ({
                    ...prev,
                    [codigo]: drawing ? { hasDoc: true, url: drawing.url_arquivo || drawing.caminho || null } : { hasDoc: false, url: null }
                }));
            } catch {
                setProductDocs(prev => ({ ...prev, [codigo]: { hasDoc: false, url: null } }));
            }
        });
    }, [ops]);

    const handleSearch = () => {
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente) {
            toast.warning('Por favor, informe um Pedido, Cliente, Produto ou OP para buscar.');
            return;
        }
        setCurrentPage(1);
        loadData(1);
    };

    const handlePlanSave = async (data) => {
        try {
            await saveProductionPlan(data);
            setPlanningOp(null);
            loadData();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar planejamento');
        }
    };

    // Refresh single operation after appointment (incremental update)
    const refreshOperation = async (op) => {
        try {
            // Build composite ID: OP|ITEM|SEQUEN|OPERACAO
            const opId = `${op.op}|${op.item_op}|${op.sequen}|${op.operacao}`;
            console.log(`🔄 [REFRESH] Fetching updated operation: ${opId}`);

            const updatedOp = await getOperationById(opId);

            // Update state: replace only the specific operation
            setOps(prevOps => prevOps.map(o =>
                (o.op === op.op && o.item_op === op.item_op && o.sequen === op.sequen && o.operacao === op.operacao)
                    ? updatedOp
                    : o
            ));

            console.log(`✅ [REFRESH] Operation updated successfully`);
        } catch (err) {
            console.error(`⚠️ [REFRESH] Failed to refresh operation, falling back to full reload`, err);
            // Fallback: if incremental fails, reload everything
            loadData();
        }
    };

    const handleAppointmentSave = async (data) => {
        try {
            await saveAppointment(data);
            setAppointingOp(null);
            // Incremental refresh - only update the affected operation
            if (appointingOp) {
                await refreshOperation(appointingOp);
            } else {
                // Fallback to full reload if op info is not available
                loadData();
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao registrar apontamento');
        }
    };

    const handleOpenMacro = async (op) => {
        try {
            console.log('🔍 [MACRO] Loading all operations for OP:', op.op);
            // Request with high limit to get ALL operations for this OP
            const res = await getProductionDashboard({ op: op.op, limit: 1000 });
            console.log('✅ [MACRO] Loaded', res.data.length, 'operations');
            console.log('📊 [MACRO] Unique operation codes:', [...new Set(res.data.map(o => o.operacao))]);
            setMacroOperations(res.data);
            setMacroModalOp(op);
        } catch (err) {
            console.error('❌ [MACRO] Error loading operations:', err);
            alert('Erro ao carregar operações');
        }
    };


    const toggleEstrutura = async (codProduto, rowKey) => {
        // Toggle off
        if (expandedRows[rowKey]) {
            setExpandedRows(prev => ({ ...prev, [rowKey]: false }));
            return;
        }
        // Toggle on
        setExpandedRows(prev => ({ ...prev, [rowKey]: true }));
        // Fetch if not cached
        if (!estruturaCache[codProduto]) {
            try {
                const data = await getEstruturaProduto(codProduto);
                setEstruturaCache(prev => ({ ...prev, [codProduto]: data }));
            } catch {
                setEstruturaCache(prev => ({ ...prev, [codProduto]: [] }));
            }
        }
    };
    const handleMacroSaveBatch = async (plans) => {
        try {
            await saveProductionPlanBatch(plans);
            setMacroModalOp(null);
            setMacroOperations([]);
            loadData();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar planejamento em lote');
        }
    };

    const getOpStatus = (op) => {
        const now = new Date();
        const start = op.data_planejada_inicio ? new Date(op.data_planejada_inicio) : null;
        let end = op.data_planejada_fim ? new Date(op.data_planejada_fim) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const done = Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op);
        const started = Number(op.qtd_produzida_real) > 0;

        if (done) return { text: 'Concluída', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700 border border-green-300' };
        if (end && now > end) return { text: 'Atrasada (Entrega)', icon: <AlertOctagon className="w-3 h-3" />, color: 'bg-red-100 text-red-700 border border-red-300' };
        if (start && now > start && !started) return { text: 'Atrasada (Início)', icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-orange-100 text-orange-700 border border-orange-300' };
        if (started) return { text: 'Em Andamento', icon: <Clock className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700 border border-blue-300' };
        if (start && end) return { text: 'Planejada', icon: <Calendar className="w-3 h-3" />, color: 'bg-slate-100 text-slate-700 border border-slate-300' };
        return { text: 'Aguardando', icon: <Clock className="w-3 h-3" />, color: 'bg-gray-100 text-gray-600 border border-gray-300' };
    };

    const calculateProgress = (op) => {
        if (calcType === 'op_specific') {
            const planned = Number(op.qtd_planejada_op);
            const produced = Number(op.qtd_produzida_real);
            if (planned === 0) return 0;
            return Math.min(100, (produced / planned) * 100);
        } else if (calcType === 'item_average') {
            // This mode assumes 'op' might have a 'percentual_item' or similar
            // If not, we'd need to group OPs by item and calculate average here.
            // For now, let's assume 'op.percentual_item' is available from the backend
            // or we'd need to fetch/calculate all OPs for the item.
            // As per the instruction, the backend already provides 'percentual_item'.
            return op.percentual_item || 0;
        }
        return 0;
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Controle de Produção</h1>
                        <p className="text-slate-500">Planejamento e Apontamento de OPs</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-white rounded-lg p-1 border shadow-sm">
                            <button
                                onClick={() => setCalcType('op_specific')}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${calcType === 'op_specific' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Progresso por OP
                            </button>
                            <button
                                onClick={() => setCalcType('item_average')}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${calcType === 'item_average' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Progresso por Item (Média)
                            </button>
                        </div>
                        <button onClick={() => setShowLegend(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Legenda de Processos
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                        <input type="text" placeholder="OP" value={filters.op} onChange={(e) => setFilters({ ...filters, op: e.target.value })} className="px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Pedido" value={filters.pedido} onChange={(e) => setFilters({ ...filters, pedido: e.target.value })} className="px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Item" value={filters.item} onChange={(e) => setFilters({ ...filters, item: e.target.value })} className="px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Seq" value={filters.sequencia} onChange={(e) => setFilters({ ...filters, sequencia: e.target.value })} className="px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Produto" value={filters.produto} onChange={(e) => setFilters({ ...filters, produto: e.target.value })} className="px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Cliente" value={filters.cliente} onChange={(e) => setFilters({ ...filters, cliente: e.target.value })} className="px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-3 py-2 border rounded-lg bg-white"
                        >
                            <option value="">Status (Padrão)</option>
                            <option value="TODOS">Todos (Incl. Antigos)</option>
                            <option value="EM_ANDAMENTO">Em Andamento</option>
                            <option value="CONCLUIDO">Concluídos</option>
                            <option value="NAO_INICIADO">Não Iniciados</option>
                        </select>
                    </div>
                    <div className="mt-3 flex gap-3">
                        <input type="text" placeholder="Operação/Recurso" value={filters.operacao} onChange={(e) => setFilters({ ...filters, operacao: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <button onClick={handleSearch} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2" disabled={loading}>
                            <Search className="w-4 h-4" />
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>
                    {/* Filter Toggles */}
                    <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="pending_delivery"
                                checked={filters.pending_delivery}
                                onChange={(e) => setFilters({ ...filters, pending_delivery: e.target.checked })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor="pending_delivery" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                                Apenas Saldo a Entregar (Pendentes)
                            </label>
                        </div>
                    </div>
                </div>

                {total > 0 && (
                    <div className="text-sm text-slate-600">
                        Mostrando {ops.length} de {total} operações
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                <th className="p-3">OP / Item / Seq</th>
                                <th className="p-3">Pedido</th>
                                <th className="p-3">Cliente</th>
                                <th className="p-3">Produto</th>
                                <th className="p-3 text-center w-10">PDF</th>
                                <th className="p-3">Operação</th>
                                <th className="p-3 text-center">Planejamento</th>
                                <th className="p-3 text-center">Produção</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="10" className="p-8 text-center text-slate-500">Carregando...</td></tr>
                            ) : ops.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="p-8 text-center text-slate-500">
                                        <div className="font-medium text-slate-700">Nenhuma operação em exibição</div>
                                        <div className="text-sm mt-1">Por questões de performance, a busca não é automática. <br />Preencha um OP, Pedido, Produto ou Cliente e clique em Buscar.</div>
                                    </td>
                                </tr>
                            ) : (
                                ops.map((op, idx) => {
                                    const status = getOpStatus(op);
                                    return (
                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-3">
                                                <div className="font-mono text-sm font-bold text-slate-900">{op.op}</div>
                                                <div className="text-xs text-slate-500">Item: {op.item_op} | Seq: {op.sequen}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-slate-700">{op.pedido_venda || '-'}</div>
                                                <div className="text-xs text-slate-500">{op.ped_cliente || '-'}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-700 max-w-[200px] truncate" title={op.nome_cliente}>{op.nome_cliente || '-'}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="font-mono text-xs text-blue-600 font-semibold">{op.cod_produto_op}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500 truncate max-w-[250px]" title={op.desc_produto}>{op.desc_produto}</div>
                                            </td>
                                            {/* PDF Column */}
                                            <td className="p-3 text-center">
                                                {(() => {
                                                    const docInfo = productDocs[op.cod_produto_op];
                                                    const hasDoc = docInfo?.hasDoc;
                                                    const url = docInfo?.url;
                                                    if (hasDoc && url) {
                                                        return (
                                                            <button
                                                                onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(url)}`), '_blank')}
                                                                className="p-1 rounded hover:bg-red-50 transition-colors"
                                                                title="Abrir Desenho/PDF"
                                                            >
                                                                <FileText className="w-4 h-4 text-red-500" />
                                                            </button>
                                                        );
                                                    }
                                                    return <FileText className="w-4 h-4 text-slate-300 mx-auto" title="Sem PDF associado" />;
                                                })()}
                                            </td>
                                            <td className="p-3">
                                                <div className="bg-blue-50 text-blue-700 inline-block px-2 py-0.5 rounded text-xs font-bold border border-blue-100 mb-1">
                                                    {op.operacao}
                                                </div>
                                                <div className="text-xs text-slate-600 truncate max-w-[150px]" title={op.desc_operacao}>{op.desc_operacao}</div>
                                                <div className="text-xs text-slate-400">{op.recurso}</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {op.data_planejada_inicio ? (
                                                    <div className="text-xs">
                                                        <div className="text-green-700 font-medium">I: {new Date(op.data_planejada_inicio).toLocaleDateString()}</div>
                                                        <div className="text-red-700 font-medium">F: {new Date(op.data_planejada_fim).toLocaleDateString()}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Não planejado</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer mb-1 hover:underline"
                                                        title="Clique para ver histórico detalhado"
                                                        onClick={() => setSelectedOpHistory({
                                                            op: op.op,
                                                            item_op: op.item_op,
                                                            sequen: op.sequen,
                                                            operacao: op.operacao
                                                        })}
                                                    >
                                                        {Number(op.qtd_produzida_real).toFixed(0)} / {Number(op.qtd_planejada_op).toFixed(0)}
                                                    </div>
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full ${Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op) ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (Number(op.qtd_produzida_real) / Number(op.qtd_planejada_op)) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                                    {status.icon} {status.text}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => setPlanningOp(op)}
                                                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded text-slate-600 transition-all" title="Planejar Operação">
                                                        <Calendar className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleOpenMacro(op)}
                                                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded text-indigo-600 transition-all" title="Planejamento Macro (Toda OP)">
                                                        <List className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setAppointingOp(op)}
                                                        className="ml-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded shadow-sm flex items-center gap-1 text-xs" title="Apontar">
                                                        <CheckSquare className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr >
                                    );
                                })
                            )}
                        </tbody >
                    </table >
                </div >

                {/* Pagination Controls */}
                {
                    totalPages > 1 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-4 flex items-center justify-between">
                            <button
                                onClick={() => loadData(currentPage - 1)}
                                disabled={currentPage === 1 || loading}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                ← Anterior
                            </button>

                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-600">
                                    Página
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    max={totalPages}
                                    value={currentPage}
                                    onChange={(e) => {
                                        const page = parseInt(e.target.value);
                                        if (page >= 1 && page <= totalPages) {
                                            loadData(page);
                                        }
                                    }}
                                    className="w-20 px-3 py-2 border rounded-lg text-center"
                                />
                                <span className="text-sm text-slate-600">
                                    de {totalPages}
                                </span>
                            </div>

                            <button
                                onClick={() => loadData(currentPage + 1)}
                                disabled={currentPage === totalPages || loading}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Próximo →
                            </button>
                        </div>
                    )
                }


                {/* MODALS */}
                {
                    selectedOpHistory && (
                        <ProductionHistoryModal
                            opData={selectedOpHistory}
                            onClose={() => setSelectedOpHistory(null)}
                        />
                    )
                }
                {
                    planningOp && (
                        <ProductionPlanningModal
                            op={planningOp}
                            onClose={() => setPlanningOp(null)}
                            onSave={handlePlanSave}
                        />
                    )
                }
                {
                    appointingOp && (
                        <ProductionAppointmentModal
                            op={appointingOp}
                            onClose={() => setAppointingOp(null)}
                            onSave={handleAppointmentSave}
                        />
                    )
                }
                {
                    macroModalOp && (
                        <ProductionMacroModal
                            op={macroModalOp}
                            operations={macroOperations}
                            onClose={() => setMacroModalOp(null)}
                            onSaveBatch={handleMacroSaveBatch}
                        />
                    )
                }
                {
                    showLegend && (
                        <ProcessLegendModal
                            onClose={() => setShowLegend(false)}
                            onSelect={(code) => {
                                setFilters({ ...filters, operacao: code });
                                setShowLegend(false);
                            }}
                        />
                    )
                }

            </div >

            {/* PRINT COMPONENT - Visible only when printing */}
            < div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:z-[9999]" >
                <ProductionPrint ops={ops} filters={filters} />
            </div >
        </>
    );
}
