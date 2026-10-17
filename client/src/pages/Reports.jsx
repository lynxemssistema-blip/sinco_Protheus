import React, { useState, useEffect } from 'react';
import useStickyState from '../hooks/useStickyState';
import {
    FileText, Download, Filter, Search, Calendar,
    BarChart2, CheckCircle, AlertTriangle, Clock, RefreshCw,
    Layers, Truck, Package, MessageSquare, Printer, GripVertical, Save
} from 'lucide-react';
import NotesDrawer from '../components/NotesDrawer';
import MeetingReportModal from '../components/MeetingReportModal';
import { useAuth } from '../contexts/AuthContext';
import { getProductionReportData, getSalesPlanningReportData, getResourceEvolutionReportData, getReportDownloadUrl, getSystemSetting, saveSystemSetting } from '../services/api';
import { generateProductionReportPdf } from '../services/productionReportPdfGenerator';
import DateInputBR from '../components/ui/DateInputBR';

// --- SUB-COMPONENTS ---

// 1. Production Report Filters & View
const ProductionReportView = ({ onExport, filters, setFilters }) => {
    const [data, setData] = useState([]);
    const [kpis, setKpis] = useState({ total_ops: 0, concluidos: 0, em_andamento: 0 });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [records, setRecords] = useState(0);

    useEffect(() => { fetchData(); }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getProductionReportData({ ...filters, page, limit: 20 });
            setData(res.rows);
            setKpis(res.kpis);
            setTotalPages(res.totalPages);
            setRecords(res.total);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData();
    };

    return (
        <div className="flex flex-col h-full space-y-4 animate-fadeIn">
            {/* KPI Cards */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard icon={BarChart2} color="blue" label="Total de OPs" value={kpis.total_ops} />
                <KPICard icon={CheckCircle} color="green" label="Concluídas" value={kpis.concluidos || '-'} />
                <KPICard icon={Clock} color="yellow" label="Em Andamento" value={kpis.em_andamento || '-'} />
                <KPICard icon={AlertTriangle} color="red" label="Atrasadas" value="-" />
            </div>

            {/* Filters */}
            <div className="flex-none bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Período (Entrega)</label>
                        <div className="flex gap-2">
                            <DateInputBR className="w-full border rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-100 border-slate-300 bg-white" value={filters.date_start} onChange={e => setFilters({ ...filters, date_start: e.target.value })} />
                            <DateInputBR className="w-full border rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-100 border-slate-300 bg-white" value={filters.date_end} onChange={e => setFilters({ ...filters, date_end: e.target.value })} />
                        </div>
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                        <select className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                            <option value="">Todos</option>
                            <option value="PENDENTE">Pendente</option>
                            <option value="EM_ANDAMENTO">Em Andamento</option>
                            <option value="CONCLUIDO">Concluído</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cliente</label>
                        <input type="text" placeholder="Buscar Cliente..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.client} onChange={e => setFilters({ ...filters, client: e.target.value })} />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Pedido</label>
                        <input type="text" placeholder="Nº" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.pedido} onChange={e => setFilters({ ...filters, pedido: e.target.value })} />
                    </div>
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-bold text-slate-700 mb-1">OP</label>
                        <input type="text" placeholder="Nº" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.op} onChange={e => setFilters({ ...filters, op: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Filtrar
                        </button>
                        <ExportButtons onExport={(type) => onExport(type, filters, 'production')} showPdf={true} />
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-4">OP</th>
                                <th className="p-4">Produto</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Pedido</th>
                                <th className="p-4 text-center">Entrega Prev.</th>
                                <th className="p-4 text-center">Progresso</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <LoadingRow cols={7} /> : data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-4 font-mono font-medium whitespace-nowrap">{row.op_completa}</td>
                                <td className="p-4 truncate max-w-[200px]" title={row.descricao}>{row.produto} <br/><span className="text-xs text-slate-500 font-normal">{row.descricao}</span></td>
                                <td className="p-4 truncate max-w-[200px]" title={row.cliente}>{row.cliente}</td>
                                <td className="p-4 font-mono">{row.pedido}</td>
                                <td className="p-4 text-center font-mono">{formatDate(row.data_entrega)}</td>
                                <td className="p-4"><ProgressBar value={row.progresso} /></td>
                                <td className="p-4 text-center"><StatusBadge status={row.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                <div className="flex-none border-t border-slate-200">
                    <Pagination page={page} totalPages={totalPages} totalRecords={records} onPageChange={setPage} />
                </div>
            </div>
        </div>
    );
};

// 2. Sales Planning Report View
const SalesPlanningReportView = ({ onExport, filters, setFilters }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [records, setRecords] = useState(0);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [viewMode, setViewMode] = useState('ORDERS'); // ORDERS | PLANNING
    const [notesTarget, setNotesTarget] = useState(null); // { order, item, product }
    const [showReportModal, setShowReportModal] = useState(false);
    const { user } = useAuth();

    useEffect(() => { fetchData(); }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getSalesPlanningReportData({ 
                ...filters, 
                delivery_start: filters.date_start, 
                delivery_end: filters.date_end, 
                order: filters.pedido, 
                page, 
                limit: 50 
            });
            setData(res.rows);
            setTotalPages(res.totalPages);
            setRecords(res.total);
            setExpandedRows(new Set()); // Collapse all on new search
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData();
    };

    const toggleRow = (id) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    // Calculate Sales KPIs specific to current loaded data (or accurate backend if available)
    // Here we estimate based on current fetch to show "something"
    const totalItens = data.reduce((acc, r) => acc + (r.itens_count || 0), 0);
    const openOrders = data.filter(r => !r.status.includes('FATURADO')).length;

    return (
        <div className="flex flex-col h-full space-y-4 animate-fadeIn">
            {/* KPI Cards */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard icon={Truck} color="blue" label="Pedidos Listados" value={records} />
                <KPICard icon={Package} color="indigo" label="Total de Itens (Pág)" value={totalItens} />
                <KPICard icon={Clock} color="yellow" label="Abertos (Pág)" value={openOrders} />
                <KPICard icon={CheckCircle} color="green" label="Entregas Hoje" value="-" />
            </div>

            {/* Filters */}
            <div className="flex-none bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Entrega (Obrigatório / Prioritário)</label>
                            <div className="flex gap-2">
                                <DateInputBR className="w-full border rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-100 border-slate-300 bg-white" value={filters.date_start} onChange={e => setFilters({ ...filters, date_start: e.target.value })} />
                                <DateInputBR className="w-full border rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-100 border-slate-300 bg-white" value={filters.date_end} onChange={e => setFilters({ ...filters, date_end: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Cliente</label>
                            <input type="text" placeholder="Nome..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.client} onChange={e => setFilters({ ...filters, client: e.target.value })} />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nº Pedido</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.pedido} onChange={e => setFilters({ ...filters, pedido: e.target.value })} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Produto (Cód/Desc)</label>
                            <input type="text" placeholder="Filtra Pedidos com este item..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.product} onChange={e => setFilters({ ...filters, product: e.target.value })} />
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-t pt-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={filters.active_only === 'true'}
                                onChange={e => setFilters({ ...filters, active_only: e.target.checked ? 'true' : 'false' })}
                            />
                            Esconder Faturados/Encerrados
                        </label>

                        <div className="flex gap-2">
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Filtrar
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowReportModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors"
                            >
                                <Printer className="h-4 w-4" /> Gerar Ata
                            </button>
                            <ExportButtons onExport={(type) => onExport(type, filters, 'sales-planning')} />
                        </div>
                    </div>
                </form>
            </div>

            {/* View Toggle (Future Implementation for "Planning View") */}
            {/* <div className="flex justify-end"><div className="...">Toggle Grid / Planning</div></div> */}

            {/* Table */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <th className="p-4">Pedido</th>
                                <th className="p-4">Emissão</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4 text-center">Itens</th>
                                <th className="p-4 text-center">Próx. Entrega</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center w-10">Obs</th>
                            </tr>
                        </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <LoadingRow cols={7} /> : data.map((row) => (
                            <React.Fragment key={row.pedido}>
                                <tr className={`hover:bg-slate-50 cursor-pointer ${expandedRows.has(row.pedido) ? 'bg-slate-50' : ''}`} onClick={() => toggleRow(row.pedido)}>
                                    <td className="p-4 text-center">
                                        <div className={`transition-transform ${expandedRows.has(row.pedido) ? 'rotate-90' : ''}`}>▶</div>
                                    </td>
                                    <td className="p-4 font-bold text-blue-700">{row.pedido}</td>
                                    <td className="p-4">{formatDate(row.emissao)}</td>
                                    <td className="p-4 truncate max-w-[250px]">{row.cliente}</td>
                                    <td className="p-4 text-center">{row.itens_count}</td>
                                    <td className="p-4 text-center font-mono font-medium text-indigo-700">{formatDate(row.proxima_entrega)}</td>
                                    <td className="p-4 text-center">
                                        <StatusBadge status={row.status} />
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setNotesTarget({ order: row.pedido }); }}
                                            className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-slate-100"
                                            title="Ver anotações do pedido"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                                {
                                    expandedRows.has(row.pedido) && (
                                        <tr>
                                            <td colSpan="8" className="p-0">
                                                <div className="bg-slate-50 border-y border-slate-200 p-4 pl-12 shadow-inner">
                                                    <table className="w-full text-xs bg-white rounded border border-slate-200">
                                                        <thead className="bg-slate-100 text-slate-600">
                                                            <tr>
                                                                <th className="p-2 text-left">Item</th>
                                                                <th className="p-2 text-left">Produto</th>
                                                                <th className="p-2 text-left">Descrição</th>
                                                                <th className="p-2 text-center">UM</th>
                                                                <th className="p-2 text-right">Qtd</th>
                                                                <th className="p-2 text-center">Entrega</th>
                                                                <th className="p-2 text-center">Entrega</th>
                                                                <th className="p-2 text-center">OP</th>
                                                                <th className="p-2 text-center w-10">Obs</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {row.itens?.map((it, i) => (
                                                                <tr key={i}>
                                                                    <td className="p-2">{it.item}</td>
                                                                    <td className="p-2 font-mono">{it.produto}</td>
                                                                    <td className="p-2">{it.descricao}</td>
                                                                    <td className="p-2 text-center">{it.um}</td>
                                                                    <td className="p-2 text-right font-bold">{it.qtd}</td>
                                                                    <td className="p-2 text-center">{formatDate(it.entrega)}</td>
                                                                    <td className="p-2 text-center">{formatDate(it.entrega)}</td>
                                                                    <td className="p-2 text-center font-mono text-blue-600">{it.op || '-'}</td>
                                                                    <td className="p-2 text-center">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setNotesTarget({ order: row.pedido, item: it.item, product: it.produto });
                                                                            }}
                                                                            className="text-slate-400 hover:text-blue-600 transition-colors"
                                                                            title="Anotações do Item"
                                                                        >
                                                                            <MessageSquare className="w-3 h-3" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                }
                            </React.Fragment>
                        ))}
                    </tbody>
                    </table>
                </div>
                <div className="flex-none border-t border-slate-200">
                    <Pagination page={page} totalPages={totalPages} totalRecords={records} onPageChange={setPage} />
                </div>
            </div>
        </div >
    );
};

// 3. Resource Evolution Report View
const ResourceEvolutionReportView = ({ onExport, filters, setFilters, user }) => {
    const [data, setData] = useState({ rows: [], columns: [] });
    const [loading, setLoading] = useState(false);
    const [orderedColumns, setOrderedColumns] = useState([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // DnD State
    const [draggedColKey, setDraggedColKey] = useState(null);

    // LocalStorage key per user for individual persistence
    const lsKey = `metalfisa_col_order_${user?.id || 'guest'}`;

    // Apply a saved order (array of keys) to the current columns from the API
    const applyOrder = (savedKeys, apiCols) => {
        if (!savedKeys || savedKeys.length === 0) return apiCols;
        const ordered = [];
        const remaining = [...apiCols];
        savedKeys.forEach(key => {
            const idx = remaining.findIndex(c => c.key === key);
            if (idx !== -1) {
                ordered.push(remaining[idx]);
                remaining.splice(idx, 1);
            }
        });
        // Append any new columns the saved order doesn't know about
        ordered.push(...remaining);
        return ordered;
    };

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Run settings and report fetch concurrently — settings failure is non-blocking
            const [settingsResult, reportResult] = await Promise.allSettled([
                getSystemSetting('resource_evolution_columns_order'),
                getResourceEvolutionReportData(filters)
            ]);

            if (reportResult.status === 'rejected') {
                console.error('Erro ao carregar dados do relatório:', reportResult.reason);
                return;
            }

            const reportDataRes = reportResult.value;
            setData(reportDataRes);
            setHasUnsavedChanges(false);

            // Priority: 1. User's localStorage  2. Admin's global DB order  3. API default
            const userLocalOrder = (() => {
                try { return JSON.parse(localStorage.getItem(lsKey)) || []; } catch { return []; }
            })();

            const globalDbOrder = settingsResult.status === 'fulfilled'
                ? (settingsResult.value?.value || [])
                : [];

            const orderToApply = userLocalOrder.length > 0 ? userLocalOrder : globalDbOrder;
            setOrderedColumns(applyOrder(orderToApply, reportDataRes.columns || []));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Save global default order to DB (admin only)
    const handleSaveGlobalOrder = async () => {
        if (!user || user.role !== 'admin') return;
        setIsSaving(true);
        try {
            const keys = orderedColumns.map(c => c.key);
            await saveSystemSetting('resource_evolution_columns_order', keys);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Erro ao salvar ordem global:', error);
            alert('Erro ao salvar o padrão global das colunas.');
        } finally {
            setIsSaving(false);
        }
    };

    // Reset user's personal order (removes from localStorage)
    const handleResetOrder = () => {
        try { localStorage.removeItem(lsKey); } catch { /* noop */ }
        setOrderedColumns(applyOrder([], data.columns || []));
        setHasUnsavedChanges(false);
    };

    const handleDragStart = (e, colKey) => {
        setDraggedColKey(colKey);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedColKey(null);
    };

    const handleDragOver = (e, targetColKey) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (!draggedColKey || draggedColKey === targetColKey) return;

        const newCols = [...orderedColumns];
        const draggedIdx = newCols.findIndex(c => c.key === draggedColKey);
        const targetIdx = newCols.findIndex(c => c.key === targetColKey);

        if (draggedIdx !== -1 && targetIdx !== -1) {
            const [draggedItem] = newCols.splice(draggedIdx, 1);
            newCols.splice(targetIdx, 0, draggedItem);
            setOrderedColumns(newCols);
            setHasUnsavedChanges(true);
            // Persist instantly to localStorage for this user
            try {
                localStorage.setItem(lsKey, JSON.stringify(newCols.map(c => c.key)));
            } catch { /* noop */ }
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

    return (
        <div className="flex flex-col h-full space-y-4 animate-fadeIn">
            {/* Filters */}
            <div className="flex-none bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Período (Entrega)</label>
                            <div className="flex gap-2">
                                <DateInputBR className="w-full border rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-100 border-slate-300 bg-white" value={filters.date_start} onChange={e => setFilters({ ...filters, date_start: e.target.value })} />
                                <DateInputBR className="w-full border rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-100 border-slate-300 bg-white" value={filters.date_end} onChange={e => setFilters({ ...filters, date_end: e.target.value })} />
                            </div>
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Agrupar Por</label>
                            <select className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.groupBy} onChange={e => setFilters({ ...filters, groupBy: e.target.value })}>
                                <option value="pedido">Pedido de Venda</option>
                                <option value="produto">Produto</option>
                                <option value="op">Ordem de Produção (OP)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Cliente</label>
                            <input type="text" placeholder="Buscar Cliente..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.client} onChange={e => setFilters({ ...filters, client: e.target.value })} />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Pedido</label>
                            <input type="text" placeholder="Nº" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.pedido} onChange={e => setFilters({ ...filters, pedido: e.target.value })} />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-bold text-slate-700 mb-1">OP</label>
                            <input type="text" placeholder="Nº" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.op} onChange={e => setFilters({ ...filters, op: e.target.value })} />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Filtrar
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto relative">
                <table className="w-full text-sm text-left whitespace-nowrap min-w-max">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-4 sticky left-0 top-0 bg-slate-50 border-r z-30 w-64 shadow-[1px_0_0_0_#e2e8f0] align-middle">
                                <div className="flex justify-between items-center w-full gap-2">
                                    <span className="truncate">{filters.groupBy === 'pedido' ? 'Pedido / Cliente' : filters.groupBy === 'produto' ? 'Produto / Descrição' : 'OP / Pedido'}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {hasUnsavedChanges && user?.role === 'admin' && (
                                            <button
                                                onClick={handleSaveGlobalOrder}
                                                disabled={isSaving}
                                                title="Salvar como padrão global para todos os usuários"
                                                className="text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded-md flex items-center gap-1 text-[10px] font-medium disabled:opacity-50 transition-colors"
                                            >
                                                {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                Global
                                            </button>
                                        )}
                                        {hasUnsavedChanges && (
                                            <button
                                                onClick={handleResetOrder}
                                                title="Redefinir para a ordem padrão"
                                                className="text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                                            >
                                                Redefinir
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </th>
                            {orderedColumns.map(col => (
                                <th
                                    key={col.key}
                                    className={`p-4 text-center border-r last:border-r-0 min-w-[200px] transition-colors select-none ${draggedColKey === col.key ? 'bg-blue-100 opacity-60' : 'hover:bg-slate-100'}`}
                                    title={`${col.label} — Arraste para reorganizar`}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, col.key)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(e, col.key)}
                                >
                                    <div className="flex items-center gap-1 w-full cursor-grab active:cursor-grabbing">
                                        <GripVertical className="w-3 h-3 text-slate-400 shrink-0" />
                                        <div className="flex flex-col flex-1 text-left min-w-0">
                                            {(() => {
                                                const parts = col.label.split(' - ');
                                                const code = parts[0]?.trim();
                                                const desc = parts.slice(1).join(' - ').trim();
                                                return (
                                                    <>
                                                        <span className="font-bold text-[11px] text-slate-700 leading-tight">{code}</span>
                                                        {desc && <span className="text-[10px] text-slate-500 leading-tight truncate">{desc}</span>}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </th>
            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <LoadingRow cols={data.columns.length + 1} /> : data.rows.length === 0 ? (
                            <tr><td colSpan={data.columns.length + 1} className="p-8 text-center text-slate-500">Nenhum dado encontrado.</td></tr>
                        ) : data.rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 border-r z-10 shadow-[1px_0_0_0_#e2e8f0]">
                                    <div className="font-bold text-slate-900">{row.id}</div>
                                    <div className="text-xs text-slate-500 truncate w-60" title={row.extra}>{row.extra}</div>
                                </td>
                                {orderedColumns.map(col => {
                                    const cell = row[col.key];
                                    return (
                                        <td key={col.key} className="p-4 border-r last:border-r-0">
                                            {cell ? (
                                                <div className="flex flex-col gap-1">
                                                    <ProgressBar value={cell.progress.toFixed(1)} />
                                                    {cell.plan_date_min && (() => {
                                                        const fmt = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                        const minFmt = fmt(cell.plan_date_min);
                                                        const maxFmt = cell.plan_date_max ? fmt(cell.plan_date_max) : null;
                                                        const label = (maxFmt && maxFmt !== minFmt) ? `${minFmt} a ${maxFmt}` : minFmt;
                                                        return (
                                                            <span className="text-[10px] text-blue-500 flex items-center gap-1">
                                                                <Calendar className="w-3 h-3 shrink-0" />
                                                                <span className="font-medium">Plan.</span>
                                                                {label}
                                                            </span>
                                                        );
                                                    })()}
                                                    {cell.date && (
                                                        <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3 shrink-0" />
                                                            <span className="font-medium">Início</span>
                                                            {new Date(cell.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-300">-</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---

export default function Reports() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useStickyState('production', '@lynxems:reports_activeTab');
    const [sharedFilters, setSharedFilters] = useStickyState({
        date_start: '',
        date_end: '',
        client: '',
        pedido: '',
        op: '',
        product: '',
        status: '',
        active_only: 'true',
        groupBy: 'pedido'
    }, '@lynxems:reports_sharedFilters');

    const handleExport = (type, filters, category) => {
        if (type === 'pdf' && category === 'production') {
            generateProductionReportPdf(filters);
            return;
        }
        const url = getReportDownloadUrl(type, filters, category);
        window.open(url, '_blank');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <div className="flex-none mb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <FileText className="h-6 w-6 text-blue-600" />
                            Relatórios Gerenciais
                        </h1>
                        <p className="text-slate-500">
                            Central de relatórios, análises e exportações.
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-none border-b border-slate-200">
                <nav className="flex gap-4" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('production')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'production'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <Layers className="h-4 w-4" />
                        Produção
                    </button>
                    <button
                        onClick={() => setActiveTab('sales-planning')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'sales-planning'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <Truck className="h-4 w-4" />
                        Vendas (Planejamento)
                    </button>
                    <button
                        onClick={() => setActiveTab('resource-evolution')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'resource-evolution'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                    >
                        <BarChart2 className="h-4 w-4" />
                        Evolução por Recurso
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden pt-6">
                {activeTab === 'production' && <ProductionReportView onExport={handleExport} filters={sharedFilters} setFilters={setSharedFilters} />}
                {activeTab === 'sales-planning' && <SalesPlanningReportView onExport={handleExport} filters={sharedFilters} setFilters={setSharedFilters} />}
                {activeTab === 'resource-evolution' && <ResourceEvolutionReportView onExport={handleExport} filters={sharedFilters} setFilters={setSharedFilters} user={user} />}
            </div>
        </div>
    );
}

// --- SHARED UI HELPERS ---

const KPICard = ({ icon: Icon, color, label, value }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
        <div className={`p-3 bg-${color}-50 text-${color}-600 rounded-lg`}>
            <Icon className="h-6 w-6" />
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
    </div>
);

const ExportButtons = ({ onExport, showPdf }) => (
    <>
        {showPdf && (
            <button type="button" onClick={() => onExport('pdf')} className="cursor-pointer bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                PDF
            </button>
        )}
        <button type="button" onClick={() => onExport('excel')} className="cursor-pointer bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            Excel
        </button>
    </>
);

const Pagination = ({ page, totalPages, totalRecords, onPageChange }) => (
    <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
        <span className="text-sm text-slate-600">Mostrando {totalRecords} registros</span>
        <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-50 text-sm">Anterior</button>
            <span className="px-3 py-1 bg-white border rounded text-sm font-medium">Pág {page} de {totalPages || 1}</span>
            <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-50 text-sm">Próxima</button>
        </div>
    </div>
);

const LoadingRow = ({ cols }) => (
    <tr><td colSpan={cols} className="p-8 text-center text-slate-500">Carregando dados...</td></tr>
);

const ProgressBar = ({ value }) => (
    <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-24">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${value}%` }}></div>
        </div>
        <span className="text-xs font-medium w-10 text-right">{value}%</span>
    </div>
);

const StatusBadge = ({ status }) => (
    <span className={`px-2 py-1 rounded text-xs font-bold 
        ${status === 'CONCLUIDO' ? 'bg-green-100 text-green-700' :
            status === 'EM_ANDAMENTO' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-600'}`}>
        {status}
    </span>
);

function formatDate(str) {
    if (!str) return '-';
    try {
        if (String(str).length === 8 && !String(str).includes('-')) { // YYYYMMDD
            return `${str.substr(6, 2)}/${str.substr(4, 2)}/${str.substr(0, 4)}`;
        }
        // Handle ISO string safely to avoid timezone offset issues (-1 day)
        const dateStr = String(str);
        const ymd = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
        if (ymd.length === 10 && ymd.includes('-')) {
            const [y, m, d] = ymd.split('-');
            return `${d}/${m}/${y}`;
        }
        return new Date(str).toLocaleDateString('pt-BR');
    } catch (e) { return str; }
}
