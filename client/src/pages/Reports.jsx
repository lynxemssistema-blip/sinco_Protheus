import React, { useState, useEffect } from 'react';
import {
    FileText, Download, Filter, Search, Calendar,
    BarChart2, CheckCircle, AlertTriangle, Clock, RefreshCw,
    Layers, Truck, Package, MessageSquare, Printer
} from 'lucide-react';
import NotesDrawer from '../components/NotesDrawer';
import MeetingReportModal from '../components/MeetingReportModal';
import { useAuth } from '../contexts/AuthContext';
import { getProductionReportData, getSalesPlanningReportData, getReportDownloadUrl } from '../services/api';

// --- SUB-COMPONENTS ---

// 1. Production Report Filters & View
const ProductionReportView = ({ onExport }) => {
    const [filters, setFilters] = useState({
        date_start: '',
        date_end: '',
        client: '',
        op: '',
        status: ''
    });
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
        <div className="space-y-6 animate-fadeIn">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard icon={BarChart2} color="blue" label="Total de OPs" value={kpis.total_ops} />
                <KPICard icon={CheckCircle} color="green" label="Concluídas" value={kpis.concluidos || '-'} />
                <KPICard icon={Clock} color="yellow" label="Em Andamento" value={kpis.em_andamento || '-'} />
                <KPICard icon={AlertTriangle} color="red" label="Atrasadas" value="-" />
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Período (Entrega)</label>
                        <div className="flex gap-2">
                            <input type="date" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.date_start} onChange={e => setFilters({ ...filters, date_start: e.target.value })} />
                            <input type="date" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.date_end} onChange={e => setFilters({ ...filters, date_end: e.target.value })} />
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
                        <label className="block text-xs font-bold text-slate-700 mb-1">OP</label>
                        <input type="text" placeholder="Nº" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.op} onChange={e => setFilters({ ...filters, op: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium transition-colors">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Filtrar
                        </button>
                        <ExportButtons onExport={(type) => onExport(type, filters, 'production')} />
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b">
                        <tr>
                            <th className="p-4">OP</th>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Pedido</th>
                            <th className="p-4 text-center">Entrega Prev.</th>
                            <th className="p-4 text-center">Progresso</th>
                            <th className="p-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? <LoadingRow cols={6} /> : data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-4 font-mono font-medium">{row.op}</td>
                                <td className="p-4 truncate max-w-[200px]" title={row.cliente}>{row.cliente}</td>
                                <td className="p-4">{row.pedido}</td>
                                <td className="p-4 text-center font-mono">{formatDate(row.data_entrega)}</td>
                                <td className="p-4"><ProgressBar value={row.progresso} /></td>
                                <td className="p-4 text-center"><StatusBadge status={row.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} totalRecords={records} onPageChange={setPage} />
            </div>
        </div>
    );
};

// 2. Sales Planning Report View
const SalesPlanningReportView = ({ onExport }) => {
    const [filters, setFilters] = useState({
        delivery_start: '',
        delivery_end: '',
        client: '',
        order: '',
        product: '',
        active_only: 'true'
    });
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
            const res = await getSalesPlanningReportData({ ...filters, page, limit: 50 });
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
        <div className="space-y-6 animate-fadeIn">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard icon={Truck} color="blue" label="Pedidos Listados" value={records} />
                <KPICard icon={Package} color="indigo" label="Total de Itens (Pág)" value={totalItens} />
                <KPICard icon={Clock} color="yellow" label="Abertos (Pág)" value={openOrders} />
                <KPICard icon={CheckCircle} color="green" label="Entregas Hoje" value="-" />
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Entrega (Obrigatório / Prioritário)</label>
                            <div className="flex gap-2">
                                <input type="date" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.delivery_start} onChange={e => setFilters({ ...filters, delivery_start: e.target.value })} />
                                <input type="date" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.delivery_end} onChange={e => setFilters({ ...filters, delivery_end: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Cliente</label>
                            <input type="text" placeholder="Nome..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.client} onChange={e => setFilters({ ...filters, client: e.target.value })} />
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nº Pedido</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none border-slate-300" value={filters.order} onChange={e => setFilters({ ...filters, order: e.target.value })} />
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b">
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
                <Pagination page={page} totalPages={totalPages} totalRecords={records} onPageChange={setPage} />
            </div>
        </div >
    );
};

// --- MAIN PAGE ---

export default function Reports() {
    const [activeTab, setActiveTab] = useState('production');

    const handleExport = (type, filters, category) => {
        const url = getReportDownloadUrl(type, filters, category);
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-6">
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

            {/* Tabs */}
            <div className="border-b border-slate-200">
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
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'production' && <ProductionReportView onExport={handleExport} />}
                {activeTab === 'sales-planning' && <SalesPlanningReportView onExport={handleExport} />}
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

const ExportButtons = ({ onExport }) => (
    <>
        <button type="button" onClick={() => onExport('pdf')} className="cursor-pointer bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            PDF
        </button>
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
    // If ISO or Date obj
    try {
        if (str.length === 8) { // YYYYMMDD
            return `${str.substr(6, 2)}/${str.substr(4, 2)}/${str.substr(0, 4)}`;
        }
        return new Date(str).toLocaleDateString();
    } catch (e) { return str; }
}
