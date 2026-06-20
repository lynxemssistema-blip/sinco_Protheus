import React, { useState, useMemo } from 'react';
import { 
    DollarSign, 
    TrendingUp, 
    CheckCircle, 
    Calendar, 
    ChevronDown, 
    ChevronUp, 
    Users, 
    ShoppingBag, 
    Package, 
    BarChart2, 
    AlertCircle,
    ArrowUpDown,
    Layers,
    List,
    FileText
} from 'lucide-react';
import { getFileUrl } from '../../services/api';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const SortableHeader = ({ label, columnKey, sortConfig, requestSort, filterValue, onFilterChange, className = "", align = "left" }) => {
    return (
        <th className={`px-2 py-2 font-semibold ${className} align-top`}>
            <div className="flex flex-col gap-1">
                <div 
                    className={`flex items-center gap-1 cursor-pointer hover:bg-slate-200/50 p-1 rounded transition-colors ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}
                    onClick={() => columnKey && requestSort(columnKey)}
                    title={columnKey ? `Clique para ordenar por ${label}` : ''}
                >
                    <span className="whitespace-nowrap">{label}</span>
                    {columnKey && (
                        <div className="flex flex-col text-slate-400">
                            <ChevronUp strokeWidth={3} className={`h-2.5 w-2.5 -mb-[2px] ${sortConfig.key === columnKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : ''}`} />
                            <ChevronDown strokeWidth={3} className={`h-2.5 w-2.5 ${sortConfig.key === columnKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : ''}`} />
                        </div>
                    )}
                </div>
                {columnKey && (
                    <input
                        type="text"
                        className="w-full min-w-[60px] text-[10px] font-normal border border-slate-200 rounded px-1.5 py-1 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-white"
                        placeholder="Filtrar..."
                        value={filterValue || ''}
                        onChange={(e) => onFilterChange(columnKey, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </th>
    );
};

const FinancialView = ({ rows, loading, error }) => {
    // Grouping: 'prev_fat', 'cliente', 'pedido', 'produto', 'sem_agrupamento'
    const [grouping, setGrouping] = useState('prev_fat');
    
    // Expanded groups state: { [groupKey]: boolean }
    const [expandedGroups, setExpandedGroups] = useState({});

    // Filter states
    const [filters, setFilters] = useState({
        cliente: '',
        pedido: '',
        produto: '',
        dateType: 'prev_fat', // 'prev_fat' or 'data_pcp'
        dataInicial: '',
        dataFinal: '',
        showMode: 'all' // 'all', 'pending', 'billed'
    });

    // Toggle expand/collapse for a specific group
    const toggleGroup = (key) => {
        setExpandedGroups(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Toggle all groups at once
    const toggleAll = (expand) => {
        if (!expand) {
            setExpandedGroups({});
        } else {
            const newExpanded = {};
            groups.forEach(g => {
                newExpanded[g.key] = true;
            });
            setExpandedGroups(newExpanded);
        }
    };

    // Reset filters
    const handleClearFilters = () => {
        setFilters({
            cliente: '',
            pedido: '',
            produto: '',
            dateType: 'prev_fat',
            dataInicial: '',
            dataFinal: '',
            showMode: 'all'
        });
    };

    // Filter rows based on filters state
    const filteredRows = useMemo(() => {
        return rows.filter(row => {
            // Customer filter
            if (filters.cliente && !row.nome_cliente?.toLowerCase().includes(filters.cliente.toLowerCase())) {
                return false;
            }
            // Order filter
            if (filters.pedido && !row.pedido?.includes(filters.pedido)) {
                return false;
            }
            // Product filter
            if (filters.produto && !row.codigo?.toLowerCase().includes(filters.produto.toLowerCase())) {
                return false;
            }
            // Date filter
            if (filters.dataInicial || filters.dataFinal) {
                const dateFieldFull = filters.dateType === 'prev_fat' ? row.data_prevista_faturamento : row.data_entrega_pcp;
                if (!dateFieldFull) return false;
                const prevDate = dateFieldFull.split('T')[0]; // Extract YYYY-MM-DD
                if (filters.dataInicial && prevDate < filters.dataInicial) return false;
                if (filters.dataFinal && prevDate > filters.dataFinal) return false;
            }
            // showMode filter
            const hasPending = parseFloat(row.qtd_faturar) > 0;
            const hasBilled = parseFloat(row.qtd_entreg) > 0;
            if (filters.showMode === 'pending' && !hasPending) return false;
            if (filters.showMode === 'billed' && !hasBilled) return false;

            return true;
        });
    }, [rows, filters]);

    // Chart data grouped by month (YYYY-MM)
    const chartData = useMemo(() => {
        const monthMap = {};
        
        const ensureMonth = (month) => {
            if (!monthMap[month]) {
                monthMap[month] = { name: month, entrega: 0, pcp: 0, prevFat: 0, rawMonth: month };
            }
        };

        filteredRows.forEach(row => {
            const qtdVen = parseFloat(row.quantidade || 0);
            const precoCadastro = parseFloat(row.preco_cadastro || 0);
            let effectiveValUnit = qtdVen > 0 ? (parseFloat(row.valor_total || 0) / qtdVen) : parseFloat(row.valor_unitario || 0);

            if (effectiveValUnit <= 0.01 && precoCadastro > 0) {
                effectiveValUnit = precoCadastro;
            }

            // Using total order value to map the financial progression
            const valPendente = parseFloat(row.qtd_faturar || 0) * effectiveValUnit;
            if (valPendente <= 0) return; // Only show pending amounts in this projection

            const formatMonth = (dateStr) => {
                if (!dateStr) return null;
                let formatted = String(dateStr).trim();
                if (/^\d{8}$/.test(formatted)) {
                    return `${formatted.substring(0,4)}-${formatted.substring(4,6)}`;
                }
                return formatted.substring(0, 7); // YYYY-MM
            };

            const mEntrega = formatMonth(row.entrega);
            const mPcp = formatMonth(row.data_entrega_pcp);
            const mPrev = formatMonth(row.data_prevista_faturamento);

            if (mEntrega) { ensureMonth(mEntrega); monthMap[mEntrega].entrega += valPendente; }
            if (mPcp) { ensureMonth(mPcp); monthMap[mPcp].pcp += valPendente; }
            if (mPrev) { ensureMonth(mPrev); monthMap[mPrev].prevFat += valPendente; }
        });

        // Convert to array and sort chronologically
        const sortedData = Object.values(monthMap).sort((a, b) => a.rawMonth.localeCompare(b.rawMonth));
        
        // Format names to MM/YYYY
        return sortedData.map(d => ({
            ...d,
            name: `${d.rawMonth.split('-')[1]}/${d.rawMonth.split('-')[0]}`
        }));
    }, [filteredRows]);

    // Grouping logic
    const groups = useMemo(() => {
        const map = {};
        
        filteredRows.forEach(row => {
            let groupKey = '';
            let groupLabel = '';
            
            if (grouping === 'prev_fat' || grouping === 'data_pcp') {
                const dateField = grouping === 'prev_fat' ? row.data_prevista_faturamento : row.data_entrega_pcp;
                if (dateField) {
                    const datePart = dateField.split('T')[0];
                    const parts = datePart.split('-');
                    groupKey = datePart;
                    const prefix = grouping === 'prev_fat' ? 'Prev. Fat' : 'Data PCP';
                    groupLabel = `${prefix}: ${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                    groupKey = 'sem_previsao';
                    groupLabel = grouping === 'prev_fat' ? 'Sem Previsão' : 'Sem Data PCP';
                }
            } else if (grouping === 'cliente') {
                groupKey = row.cod_cliente || 'sem_cliente';
                groupLabel = row.nome_cliente || 'Cliente não Identificado';
            } else if (grouping === 'pedido') {
                groupKey = row.pedido || 'sem_pedido';
                groupLabel = `Pedido: ${row.pedido}`;
            } else if (grouping === 'produto') {
                groupKey = row.codigo || 'sem_produto';
                groupLabel = `${row.codigo} - ${row.descricao || ''}`;
            } else {
                groupKey = 'plana';
                groupLabel = 'Visão Sem Agrupamento';
            }
            
            if (!map[groupKey]) {
                map[groupKey] = {
                    key: groupKey,
                    label: groupLabel,
                    items: [],
                    totalPendente: 0,
                    totalFaturado: 0,
                    totalGeral: 0,
                    qtdPendente: 0,
                    qtdFaturada: 0,
                    qtdTotal: 0
                };
            }
            
            const qtdVen = parseFloat(row.quantidade || 0);
            const qtdEnt = parseFloat(row.qtd_entreg || 0);
            const qtdFat = parseFloat(row.qtd_faturar || 0);
            
            const precoCadastro = parseFloat(row.preco_cadastro || 0);
            let effectiveValUnit = qtdVen > 0 ? (parseFloat(row.valor_total || 0) / qtdVen) : parseFloat(row.valor_unitario || 0);
            
            // Use fallback if order value is symbolic (<= 0.01)
            if (effectiveValUnit <= 0.01 && precoCadastro > 0) {
                effectiveValUnit = precoCadastro;
            }
            
            const valTotalItem = effectiveValUnit * qtdVen;
            const valPendente = qtdFat * effectiveValUnit;
            const valFaturado = qtdEnt * effectiveValUnit;
            const valTotal = valTotalItem;
            
            map[groupKey].items.push(row);
            map[groupKey].totalPendente += valPendente;
            map[groupKey].totalFaturado += valFaturado;
            map[groupKey].totalGeral += valTotal;
            map[groupKey].qtdPendente += qtdFat;
            map[groupKey].qtdFaturada += qtdEnt;
            map[groupKey].qtdTotal += qtdVen;
        });
        
        return Object.values(map).sort((a, b) => {
            if (a.key === 'sem_previsao' || a.key === 'sem_cliente' || a.key === 'sem_pedido' || a.key === 'sem_produto') return 1;
            if (b.key === 'sem_previsao' || b.key === 'sem_cliente' || b.key === 'sem_pedido' || b.key === 'sem_produto') return -1;
            
            if (grouping === 'prev_fat' || grouping === 'data_pcp') {
                // Sort by date key chronologically
                return a.key.localeCompare(b.key);
            }
            return a.label.localeCompare(b.label);
        });
    }, [filteredRows, grouping]);

    // Financial KPI Totals
    const totals = useMemo(() => {
        let totalPendente = 0;
        let totalFaturado = 0;
        let totalGeral = 0;
        let itemsCount = filteredRows.length;
        
        filteredRows.forEach(row => {
            const qtdVen = parseFloat(row.quantidade || 0);
            const precoCadastro = parseFloat(row.preco_cadastro || 0);
            let effectiveValUnit = qtdVen > 0 ? (parseFloat(row.valor_total || 0) / qtdVen) : parseFloat(row.valor_unitario || 0);

            if (effectiveValUnit <= 0.01 && precoCadastro > 0) {
                effectiveValUnit = precoCadastro;
            }

            totalPendente += parseFloat(row.qtd_faturar || 0) * effectiveValUnit;
            totalFaturado += parseFloat(row.qtd_entreg || 0) * effectiveValUnit;
            totalGeral += (effectiveValUnit * qtdVen);
        });
        
        return { totalPendente, totalFaturado, totalGeral, itemsCount };
    }, [filteredRows]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const getGroupIcon = () => {
        switch (grouping) {
            case 'prev_fat': return <Calendar className="h-5 w-5 text-indigo-500" />;
            case 'cliente': return <Users className="h-5 w-5 text-emerald-500" />;
            case 'pedido': return <ShoppingBag className="h-5 w-5 text-blue-500" />;
            case 'produto': return <Package className="h-5 w-5 text-orange-500" />;
            default: return <Layers className="h-5 w-5 text-slate-500" />;
        }
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
            {/* Top filter bar specific for financial analysis */}
            <div className="p-4 bg-white border-b border-gray-200 shrink-0 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-blue-600 animate-pulse" />
                            Painel Financeiro de Itens a Faturar
                        </h3>
                        <p className="text-xs text-gray-500">Agregações de valores faturados, saldos pendentes e previsões.</p>
                    </div>

                    {/* Grouping Selector */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch lg:self-auto">
                        <span className="text-[11px] font-bold text-slate-500 uppercase px-2">Agrupar por:</span>
                        <button
                            onClick={() => { 
                                setGrouping('prev_fat'); 
                                toggleAll(false); 
                                setFilters(prev => ({ ...prev, dateType: 'prev_fat' }));
                            }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${grouping === 'prev_fat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                        >
                            Prev. Faturamento
                        </button>
                        <button
                            onClick={() => { 
                                setGrouping('data_pcp'); 
                                toggleAll(false); 
                                setFilters(prev => ({ ...prev, dateType: 'data_pcp' }));
                            }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${grouping === 'data_pcp' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                        >
                            Data PCP
                        </button>
                        <button
                            onClick={() => { setGrouping('cliente'); toggleAll(false); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${grouping === 'cliente' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                        >
                            Cliente
                        </button>
                        <button
                            onClick={() => { setGrouping('pedido'); toggleAll(false); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${grouping === 'pedido' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                        >
                            Pedido
                        </button>
                        <button
                            onClick={() => { setGrouping('produto'); toggleAll(false); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${grouping === 'produto' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                        >
                            Produto
                        </button>
                        <button
                            onClick={() => { setGrouping('sem_agrupamento'); toggleAll(false); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${grouping === 'sem_agrupamento' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200/50'}`}
                        >
                            Sem Agrupamento
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 pt-3 border-t border-slate-100">
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Cliente</label>
                        <input
                            type="text"
                            placeholder="Filtrar por nome..."
                            value={filters.cliente}
                            onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Pedido</label>
                        <input
                            type="text"
                            placeholder="Nº Pedido..."
                            value={filters.pedido}
                            onChange={(e) => setFilters(prev => ({ ...prev, pedido: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Produto</label>
                        <input
                            type="text"
                            placeholder="Código..."
                            value={filters.produto}
                            onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                            <select 
                                value={filters.dateType} 
                                onChange={(e) => setFilters(prev => ({ ...prev, dateType: e.target.value }))}
                                className="text-[10px] font-bold text-slate-500 uppercase bg-transparent outline-none cursor-pointer hover:text-blue-600"
                            >
                                <option value="prev_fat">Prev. Fat. De</option>
                                <option value="data_pcp">Data PCP De</option>
                            </select>
                        </div>
                        <input
                            type="date"
                            value={filters.dataInicial}
                            onChange={(e) => setFilters(prev => ({ ...prev, dataInicial: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Até</label>
                        <input
                            type="date"
                            value={filters.dataFinal}
                            onChange={(e) => setFilters(prev => ({ ...prev, dataFinal: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Status Faturamento</label>
                        <select
                            value={filters.showMode}
                            onChange={(e) => setFilters(prev => ({ ...prev, showMode: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-slate-50 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="all">Ver Tudo</option>
                            <option value="pending">Apenas Pendentes (A Faturar)</option>
                            <option value="billed">Apenas Faturados (NFs emitidas)</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                    <div className="flex gap-2">
                        <button
                            onClick={() => toggleAll(true)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-all"
                        >
                            Expandir Todos
                        </button>
                        <button
                            onClick={() => toggleAll(false)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-all"
                        >
                            Recolher Todos
                        </button>
                    </div>

                    {(filters.cliente || filters.pedido || filters.produto || filters.dataInicial || filters.dataFinal || filters.showMode !== 'all') && (
                        <button
                            onClick={handleClearFilters}
                            className="text-[11px] text-red-500 hover:text-red-700 font-bold flex items-center gap-1 transition-colors"
                        >
                            Limpar Filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Financial Comparative Chart */}
            {chartData.length > 0 && (
                <div className="p-4 bg-white border-b border-gray-200 shrink-0 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-indigo-500" />
                        A Faturar por Mês: Comparativo (Entrega Original vs Data PCP vs Previsão de Faturamento)
                    </h4>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 12, fill: '#64748b' }} 
                                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                    dx={-10}
                                    width={80}
                                />
                                <RechartsTooltip 
                                    formatter={(value) => formatCurrency(value)}
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Bar dataKey="entrega" name="Original (Entrega)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="pcp" name="Data PCP" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="prevFat" name="Prev. Faturamento" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Financial summary metrics card layout */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0 bg-slate-50 border-b border-gray-200">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-xl border border-indigo-200/50 shadow-sm flex items-center justify-between transition-transform duration-200 hover:scale-[1.02]">
                    <div>
                        <span className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider">A Faturar (Pendente)</span>
                        <span className="text-lg sm:text-xl font-black text-indigo-900 font-mono mt-1 block">
                            {formatCurrency(totals.totalPendente)}
                        </span>
                    </div>
                    <div className="bg-indigo-500/10 p-2.5 rounded-lg text-indigo-600">
                        <TrendingUp className="h-6 w-6 animate-pulse" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-xl border border-emerald-200/50 shadow-sm flex items-center justify-between transition-transform duration-200 hover:scale-[1.02]">
                    <div>
                        <span className="block text-xs font-semibold text-emerald-700 uppercase tracking-wider">Já Faturado</span>
                        <span className="text-lg sm:text-xl font-black text-emerald-900 font-mono mt-1 block">
                            {formatCurrency(totals.totalFaturado)}
                        </span>
                    </div>
                    <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-600">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-slate-100 to-slate-200/50 p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between transition-transform duration-200 hover:scale-[1.02]">
                    <div>
                        <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Geral</span>
                        <span className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1 block">
                            {formatCurrency(totals.totalGeral)}
                        </span>
                    </div>
                    <div className="bg-slate-500/10 p-2.5 rounded-lg text-slate-700">
                        <DollarSign className="h-6 w-6" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Faturamento Concluído</span>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-lg font-black text-slate-800 font-mono">
                                {totals.totalGeral > 0 ? Math.round((totals.totalFaturado / totals.totalGeral) * 100) : 0}%
                            </span>
                            <span className="text-[11px] text-gray-400">({totals.itemsCount} itens)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                            <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${totals.totalGeral > 0 ? (totals.totalFaturado / totals.totalGeral) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main scrollable body */}
            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-3"></div>
                        <span className="text-slate-500 font-medium">Processando e consolidando agregados financeiros...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm text-red-500">
                        <AlertCircle className="h-12 w-12 mb-3" />
                        <span className="font-semibold text-lg">Erro ao carregar dados</span>
                        <p className="text-sm text-gray-400 mt-1">{error}</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm text-gray-400">
                        <AlertCircle className="h-10 w-10 mb-2" />
                        <span>Nenhum item com dados financeiros corresponde aos filtros selecionados.</span>
                    </div>
                ) : grouping === 'sem_agrupamento' ? (
                    /* Flat table when no grouping selected */
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-gray-200 font-bold text-xs text-slate-600 uppercase flex items-center gap-1.5">
                            <List className="h-4 w-4" /> Itens Listados ({filteredRows.length})
                        </div>
                        <div className="overflow-auto max-h-[600px]">
                            <FlatDetailsTable items={filteredRows} formatCurrency={formatCurrency} formatProtheusDate={(d) => d} />
                        </div>
                    </div>
                ) : (
                    /* Cards Grid Layout (Option B) */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                        {groups.map(group => {
                            const isExpanded = !!expandedGroups[group.key];
                            const percentBilled = group.totalGeral > 0 ? Math.round((group.totalFaturado / group.totalGeral) * 100) : 0;
                            
                            return (
                                <div 
                                    key={group.key} 
                                    className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm transition-all duration-200 flex flex-col hover:shadow-md ${isExpanded ? 'md:col-span-2 xl:col-span-3' : 'hover:scale-[1.01]'}`}
                                >
                                    {/* Card Header */}
                                    <div 
                                        onClick={() => toggleGroup(group.key)}
                                        className="p-4 cursor-pointer flex items-center justify-between border-b border-slate-100 select-none hover:bg-slate-50/55 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="p-2 bg-slate-100 rounded-xl shrink-0">
                                                {getGroupIcon()}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-800 text-sm sm:text-base truncate" title={group.label}>
                                                    {group.label}
                                                </h4>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                                                    {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${percentBilled >= 100 ? 'bg-emerald-100 text-emerald-700' : percentBilled > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {percentBilled}% Fat.
                                            </span>
                                            {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                        </div>
                                    </div>

                                    {/* Card Body (Summary Info) */}
                                    <div className="p-4 grid grid-cols-3 gap-2 bg-slate-50/30">
                                        <div className="border-r border-slate-100 pr-1">
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">A Faturar</span>
                                            <span className="text-xs sm:text-sm font-black text-indigo-950 font-mono mt-0.5 block truncate">
                                                {formatCurrency(group.totalPendente)}
                                            </span>
                                        </div>
                                        <div className="border-r border-slate-100 px-1">
                                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Já Faturado</span>
                                            <span className="text-xs sm:text-sm font-black text-emerald-950 font-mono mt-0.5 block truncate">
                                                {formatCurrency(group.totalFaturado)}
                                            </span>
                                        </div>
                                        <div className="pl-1">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Geral</span>
                                            <span className="text-xs sm:text-sm font-black text-slate-950 font-mono mt-0.5 block truncate">
                                                {formatCurrency(group.totalGeral)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Detail View */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 overflow-hidden bg-white rounded-b-2xl">
                                            <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                                    <List className="h-3.5 w-3.5 text-slate-400" /> Detalhes dos Itens do Grupo
                                                </span>
                                            </div>
                                            <div className="overflow-auto max-h-[400px]">
                                                <FlatDetailsTable items={group.items} formatCurrency={formatCurrency} formatProtheusDate={(d) => d} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// Internal table detail rendering
const FlatDetailsTable = ({ items, formatCurrency }) => {
    const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
    const [columnFilters, setColumnFilters] = useState({});

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleColumnFilterChange = (key, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const formatProtheusDate = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '-';
        if (raw.includes('T')) {
            const datePart = raw.split('T')[0];
            const d = datePart.split('-');
            if (d.length === 3) return `${d[2]}/${d[1]}/${d[0]}`;
        }
        if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        return raw;
    };

    const sortedAndFilteredItems = useMemo(() => {
        let result = items;

        // Apply column filters
        Object.keys(columnFilters).forEach(key => {
            const filterValue = (columnFilters[key] || '').toLowerCase();
            if (filterValue) {
                result = result.filter(r => {
                    if (key === 'data_prevista_faturamento') return String(formatProtheusDate(r[key]) || '').toLowerCase().includes(filterValue);
                    return String(r[key] || '').toLowerCase().includes(filterValue);
                });
            }
        });

        // Apply sorting
        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Numeric sorting
                const numericFields = ['valor_unitario', 'valor_total', 'quantidade', 'qtd_entreg', 'qtd_faturar'];
                if (numericFields.includes(sortConfig.key)) {
                    const diff = parseFloat(aValue || 0) - parseFloat(bValue || 0);
                    return sortConfig.direction === 'asc' ? diff : -diff;
                }

                // String sorting
                const strA = String(aValue || '').toLowerCase();
                const strB = String(bValue || '').toLowerCase();
                if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [items, columnFilters, sortConfig]);

    return (
        <table className="w-full text-xs text-left text-slate-600 whitespace-nowrap">
            <thead className="text-[10px] text-slate-700 uppercase bg-slate-50 border-b border-slate-100 font-bold sticky top-0">
                <tr>
                    <th className="px-3 py-2 text-center align-top pt-5">Doc/PDF</th>
                    <SortableHeader label="Pedido" columnKey="pedido" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['pedido']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Item" columnKey="item" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['item']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Cód. Produto" columnKey="codigo" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['codigo']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Descrição" columnKey="descricao" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['descricao']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Cliente" columnKey="nome_cliente" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['nome_cliente']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="V. Unitário" columnKey="valor_unitario" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['valor_unitario']} onFilterChange={handleColumnFilterChange} />
                    <th className="px-3 py-2 text-right text-indigo-700 bg-indigo-50/20 align-top pt-5">A Faturar (R$)</th>
                    <th className="px-3 py-2 text-right text-emerald-700 bg-emerald-50/20 align-top pt-5">Faturado (R$)</th>
                    <SortableHeader label="Total (R$)" columnKey="valor_total" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['valor_total']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Qtd. Solicitada" columnKey="quantidade" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['quantidade']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Qtd. A Faturar" columnKey="qtd_faturar" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['qtd_faturar']} onFilterChange={handleColumnFilterChange} className="text-indigo-700 bg-indigo-50/20" />
                    <SortableHeader label="Qtd. Entregue" columnKey="qtd_entreg" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['qtd_entreg']} onFilterChange={handleColumnFilterChange} className="text-emerald-700 bg-emerald-50/20" />
                    <SortableHeader label="Data PCP" columnKey="data_entrega_pcp" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['data_entrega_pcp']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Prev. Faturamento" columnKey="data_prevista_faturamento" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['data_prevista_faturamento']} onFilterChange={handleColumnFilterChange} />
                    <th className="px-3 py-2 text-center align-top pt-5">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
                {sortedAndFilteredItems.map((row, idx) => {
                    const qtyTotal = parseFloat(row.quantidade || 0);
                    const precoCadastro = parseFloat(row.preco_cadastro || 0);
                    let effectiveValUnit = qtyTotal > 0 ? (parseFloat(row.valor_total || 0) / qtyTotal) : parseFloat(row.valor_unitario || 0);
                    
                    if (effectiveValUnit <= 0.01 && precoCadastro > 0) {
                        effectiveValUnit = precoCadastro;
                    }
                    
                    const valTotalItem = effectiveValUnit * qtyTotal;
                    
                    const qtyFaturar = parseFloat(row.qtd_faturar || 0);
                    const qtyEntreg = parseFloat(row.qtd_entreg || 0);
                    
                    const isBilled = qtyFaturar <= 0;
                    
                    return (
                        <tr key={idx} className={`hover:bg-slate-50/50 ${isBilled ? 'bg-slate-50/30 opacity-75' : 'bg-white'}`}>
                            <td className="px-3 py-1.5 text-center">
                                {row.has_docs ? (
                                    <FileText 
                                        onClick={() => { 
                                            if (row.drawing_url || row.first_doc) {
                                                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.drawing_url || row.first_doc)}`), '_blank'); 
                                            } else {
                                                toast.info("A URL do arquivo PDF não está no cache da nuvem."); 
                                            }
                                        }}
                                        className="w-3.5 h-3.5 mx-auto text-red-500 cursor-pointer hover:text-red-700 transition-colors" 
                                    />
                                ) : (
                                    <FileText className="w-3.5 h-3.5 mx-auto text-slate-300" title="Sem documento" />
                                )}
                            </td>
                            <td className="px-3 py-1.5 font-bold text-slate-900">{row.pedido}</td>
                            <td className="px-3 py-1.5 font-mono text-[10px]">{row.item}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-500 font-bold">{row.codigo}</td>
                            <td className="px-3 py-1.5">
                                <div className="truncate max-w-[150px]" title={row.descricao}>{row.descricao}</div>
                            </td>
                            <td className="px-3 py-1.5">
                                <div className="truncate max-w-[120px]" title={row.nome_cliente}>{row.nome_cliente}</div>
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-slate-500">{formatCurrency(effectiveValUnit)}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">{formatCurrency(qtyFaturar * effectiveValUnit)}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/10">{formatCurrency(qtyEntreg * effectiveValUnit)}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-950">{formatCurrency(valTotalItem)}</td>
                            
                            <td className="px-3 py-1.5 text-right font-mono">{qtyTotal.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-600 bg-indigo-50/10">{qtyFaturar.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600 bg-emerald-50/10">{qtyEntreg.toLocaleString()}</td>
                            
                            <td className="px-3 py-1.5 text-center text-[11px] font-bold text-cyan-700">
                                {row.data_entrega_pcp ? formatProtheusDate(row.data_entrega_pcp) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-center text-[11px] font-bold text-teal-700">
                                {row.data_prevista_faturamento ? formatProtheusDate(row.data_prevista_faturamento) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                                {qtyFaturar <= 0 ? (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] uppercase font-bold py-0.5 px-1.5 rounded">Faturado 100%</span>
                                ) : qtyEntreg > 0 ? (
                                    <span className="bg-orange-100 text-orange-800 text-[9px] uppercase font-bold py-0.5 px-1.5 rounded">Fat. Parcial</span>
                                ) : (
                                    <span className="bg-slate-100 text-slate-600 text-[9px] uppercase font-bold py-0.5 px-1.5 rounded">A Faturar</span>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

export default FinancialView;
