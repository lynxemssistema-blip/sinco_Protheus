import React, { useState, useMemo, useRef } from 'react';
import { 
    DollarSign, 
    TrendingUp, 
    CheckCircle, 
    Calendar, 
    ChevronDown, 
    ChevronUp, 
    ChevronRight,
    Users, 
    ShoppingBag, 
    Package, 
    BarChart2, 
    AlertCircle,
    Layers, 
    List, 
    FileText,
    Eye,
    EyeOff,
    Flame,
    FileSpreadsheet,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { getFileUrl } from '../../services/api';
import { toast } from 'react-toastify';
import useStickyState from '../../hooks/useStickyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportFinancialExcel } from '../../services/financialExcelGenerator';

const SortableHeader = ({ label, columnKey, sortConfig, requestSort, filterValue, onFilterChange, className = "", align = "left" }) => {
    return (
        <th className={`px-2 py-1.5 font-semibold ${className} align-top`}>
            <div className="flex flex-col gap-1">
                <div 
                    className={`flex items-center gap-1 cursor-pointer hover:bg-slate-200/60 p-1 rounded transition-colors ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}
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
                        className="w-full min-w-[55px] text-[10px] font-normal border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-slate-700 bg-white"
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

const FinancialView = ({ rows, loading, error, onRefresh }) => {
    // Grouping: 'prev_fat', 'data_pcp', 'cliente', 'pedido', 'produto', 'sem_agrupamento'
    const [grouping, setGrouping] = useStickyState('prev_fat', '@lynxems:financial_grouping');
    
    // Expanded groups state: { [groupKey]: boolean }
    const [expandedGroups, setExpandedGroups] = useState({});

    // Toggle do gráfico comparativo com persistência no LocalStorage (padrão: recolhido/falso)
    const [showComparativeChart, setShowComparativeChart] = useStickyState(false, '@lynxems:financial_show_chart');

    // Filter states persistentes
    const [filters, setFilters] = useStickyState({
        cliente: '',
        pedido: '',
        produto: '',
        dateType: 'prev_fat', // 'prev_fat' or 'data_pcp'
        dataInicial: '',
        dataFinal: '',
        showMode: 'all' // 'all', 'pending', 'billed'
    }, '@lynxems:financial_filters');

    // Estado do progresso da exportação Excel em tempo real
    const [exportProgress, setExportProgress] = useState(null);

    const timelineContainerRef = useRef(null);

    // Disparador da exportação financeira no Padrão Lynx com feedback em tempo real
    const handleExportFinancialExcel = async () => {
        if (!filteredRows || filteredRows.length === 0) {
            toast.warning('Nenhum item filtrado para exportação.');
            return;
        }

        try {
            setExportProgress({
                percent: 0,
                current: 0,
                total: filteredRows.length,
                stepMessage: 'Iniciando preparação dos dados...'
            });

            const fileName = await exportFinancialExcel(filteredRows, filters, grouping, (progress) => {
                setExportProgress(progress);
            });

            toast.success(`Planilha "${fileName}" exportada com sucesso no padrão Lynx!`);
        } catch (err) {
            console.error('Erro ao exportar Excel Financeiro:', err);
            toast.error('Erro ao gerar planilha: ' + (err.message || err));
        } finally {
            setTimeout(() => {
                setExportProgress(null);
            }, 600);
        }
    };

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
                const prevDate = dateFieldFull.split('T')[0]; // YYYY-MM-DD
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

            const valPendente = parseFloat(row.qtd_faturar || 0) * effectiveValUnit;
            if (valPendente <= 0) return;

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

        const sortedData = Object.values(monthMap).sort((a, b) => a.rawMonth.localeCompare(b.rawMonth));
        
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
            let weekDay = '';
            
            if (grouping === 'prev_fat' || grouping === 'data_pcp') {
                const dateField = grouping === 'prev_fat' ? row.data_prevista_faturamento : row.data_entrega_pcp;
                if (dateField) {
                    const datePart = dateField.split('T')[0];
                    const parts = datePart.split('-');
                    groupKey = datePart;
                    
                    if (parts.length === 3) {
                        const y = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        const d = parseInt(parts[2], 10);
                        const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
                        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                        weekDay = days[dateObj.getUTCDay()] || '';
                    }

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
                    weekDay: weekDay,
                    dateRaw: (grouping === 'prev_fat' || grouping === 'data_pcp') && groupKey !== 'sem_previsao' ? groupKey : null,
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

    // Timeline diária compacta com acumulado contínuo
    const dailyTimelineData = useMemo(() => {
        if (grouping !== 'prev_fat' && grouping !== 'data_pcp') return [];
        
        const dateGroups = groups.filter(g => g.dateRaw);
        if (dateGroups.length === 0) return [];

        let runningAccumulator = 0;
        const maxVal = Math.max(...dateGroups.map(g => g.totalPendente), 1);

        return dateGroups.map(g => {
            runningAccumulator += g.totalPendente;
            const isPeak = g.totalPendente >= maxVal * 0.65 && g.totalPendente > 0;
            const parts = g.dateRaw.split('-');
            const shortDate = `${parts[2]}/${parts[1]}`;

            return {
                ...g,
                shortDate,
                runningAccumulator,
                isPeak,
                intensityPercent: Math.min(100, Math.round((g.totalPendente / maxVal) * 100))
            };
        });
    }, [groups, grouping]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const formatShortCurrency = (val) => {
        if (!val || val === 0) return 'R$ 0';
        if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`;
        return `R$ ${Math.round(val)}`;
    };

    const getGroupIcon = () => {
        switch (grouping) {
            case 'prev_fat': return <Calendar className="h-4 w-4 text-indigo-600" />;
            case 'data_pcp': return <Calendar className="h-4 w-4 text-cyan-600" />;
            case 'cliente': return <Users className="h-4 w-4 text-emerald-600" />;
            case 'pedido': return <ShoppingBag className="h-4 w-4 text-blue-600" />;
            case 'produto': return <Package className="h-4 w-4 text-amber-600" />;
            default: return <Layers className="h-4 w-4 text-slate-600" />;
        }
    };

    const handleScrollToGroup = (groupKey) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: true }));
        const el = document.getElementById(`group-row-${groupKey}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-indigo-400');
            setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 1500);
        }
    };

    return (
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
            {/* 1. COMPACT FINANCIAL TOOLBAR */}
            <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0 shadow-sm">
                <div className="flex flex-col xl:flex-row gap-2.5 justify-between items-start xl:items-center">
                    {/* Title + Indicator */}
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                            <BarChart2 className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 leading-none flex items-center gap-1.5">
                                Painel Financeiro
                                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold">
                                    {filteredRows.length} itens
                                </span>
                            </h3>
                            <span className="text-[11px] text-slate-400">Valores faturados, saldos pendentes e projeções diárias</span>
                        </div>
                    </div>

                    {/* Grouping Selector Buttons */}
                    <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full xl:w-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5">Agrupar:</span>
                        <button
                            onClick={() => { 
                                setGrouping('prev_fat'); 
                                toggleAll(false); 
                                setFilters(prev => ({ ...prev, dateType: 'prev_fat' }));
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${grouping === 'prev_fat' ? 'bg-white text-indigo-700 shadow-xs font-bold border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Prev. Faturamento
                        </button>
                        <button
                            onClick={() => { 
                                setGrouping('data_pcp'); 
                                toggleAll(false); 
                                setFilters(prev => ({ ...prev, dateType: 'data_pcp' }));
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${grouping === 'data_pcp' ? 'bg-white text-cyan-700 shadow-xs font-bold border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Data PCP
                        </button>
                        <button
                            onClick={() => { setGrouping('cliente'); toggleAll(false); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${grouping === 'cliente' ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Cliente
                        </button>
                        <button
                            onClick={() => { setGrouping('pedido'); toggleAll(false); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${grouping === 'pedido' ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Pedido
                        </button>
                        <button
                            onClick={() => { setGrouping('produto'); toggleAll(false); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${grouping === 'produto' ? 'bg-white text-amber-700 shadow-xs font-bold border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Produto
                        </button>
                        <button
                            onClick={() => { setGrouping('sem_agrupamento'); toggleAll(false); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${grouping === 'sem_agrupamento' ? 'bg-white text-slate-800 shadow-xs font-bold border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Sem Agrupamento
                        </button>
                    </div>
                </div>

                {/* Filters Input Row (Compact 6 Cols) */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-2 pt-2 border-t border-slate-100">
                    <div>
                        <input
                            type="text"
                            placeholder="Buscar Cliente..."
                            value={filters.cliente}
                            onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Nº Pedido..."
                            value={filters.pedido}
                            onChange={(e) => setFilters(prev => ({ ...prev, pedido: e.target.value }))}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Cód. Produto..."
                            value={filters.produto}
                            onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value }))}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <select 
                            value={filters.dateType} 
                            onChange={(e) => setFilters(prev => ({ ...prev, dateType: e.target.value }))}
                            className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1 py-1 border border-slate-200 outline-none cursor-pointer"
                            title="Filtrar por tipo de data"
                        >
                            <option value="prev_fat">Prev</option>
                            <option value="data_pcp">PCP</option>
                        </select>
                        <input
                            type="date"
                            value={filters.dataInicial}
                            onChange={(e) => setFilters(prev => ({ ...prev, dataInicial: e.target.value }))}
                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 outline-none focus:bg-white"
                            title="Data Inicial"
                        />
                    </div>
                    <div>
                        <input
                            type="date"
                            value={filters.dataFinal}
                            onChange={(e) => setFilters(prev => ({ ...prev, dataFinal: e.target.value }))}
                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 outline-none focus:bg-white"
                            title="Data Final"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <select
                            value={filters.showMode}
                            onChange={(e) => setFilters(prev => ({ ...prev, showMode: e.target.value }))}
                            className="flex-1 px-1.5 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 outline-none focus:bg-white"
                        >
                            <option value="all">Ver Tudo</option>
                            <option value="pending">Apenas Pendentes</option>
                            <option value="billed">Apenas Faturados</option>
                        </select>

                        {onRefresh && (
                            <button
                                type="button"
                                onClick={() => onRefresh()}
                                disabled={loading}
                                className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-md transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
                                title="Atualizar dados com base nos filtros"
                            >
                                <RefreshCw className={`h-3 w-3 shrink-0 ${loading ? 'animate-spin' : ''}`} />
                                <span className="hidden xl:inline">{loading ? 'Atualizando...' : 'Atualizar'}</span>
                            </button>
                        )}

                        {(filters.cliente || filters.pedido || filters.produto || filters.dataInicial || filters.dataFinal || filters.showMode !== 'all') && (
                            <button
                                onClick={handleClearFilters}
                                className="px-2 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                                title="Limpar todos os filtros"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

                {/* Sub-actions toolbar */}
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100 text-[11px]">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => toggleAll(true)}
                            className="px-2 py-0.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                            Expandir Todos
                        </button>
                        <button
                            onClick={() => toggleAll(false)}
                            className="px-2 py-0.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                            Recolher Todos
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <button
                                type="button"
                                onClick={() => onRefresh()}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-700 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                                title="Recarregar e atualizar dados do servidor com base nos filtros"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
                                <span>{loading ? 'Atualizando Dados...' : 'Atualizar Dados com Base nos Filtros'}</span>
                            </button>
                        )}
                        {/* Botão de Exportação para Excel Padrão Lynx */}
                        <button
                            type="button"
                            onClick={handleExportFinancialExcel}
                            disabled={exportProgress !== null || filteredRows.length === 0}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
                            title="Exportar Carteira Financeira Analítica e Consolidada para Excel (Padrão Oficial Lynx)"
                        >
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            <span>Exportar Excel (Lynx)</span>
                            <span className="text-[10px] bg-emerald-800/40 px-1.5 py-0.2 rounded font-mono">
                                {filteredRows.length}
                            </span>
                        </button>

                        {/* TOGGLE DO GRÁFICO COMPARATIVO MENSAL */}
                        <button
                            type="button"
                            onClick={() => setShowComparativeChart(prev => !prev)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all border ${
                                showComparativeChart 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Alternar visibilidade do gráfico comparativo mensal"
                        >
                            <BarChart2 className="h-3.5 w-3.5" />
                            <span>Comparativo Mensal</span>
                            {showComparativeChart ? (
                                <span className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-100/60 px-1 rounded">
                                    <Eye className="h-3 w-3" /> Visível
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-200/60 px-1 rounded">
                                    <EyeOff className="h-3 w-3" /> Oculto
                                </span>
                            )}
                            {showComparativeChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. FINANCIAL COMPARATIVE CHART (COLLAPSIBLE WITH ZERO WASTED SPACE) */}
            {showComparativeChart && chartData.length > 0 && (
                <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0 transition-all duration-300 animate-fadeIn">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">
                                Projeção Mensal de Faturamento (Entrega Original vs PCP vs Prev. Faturamento)
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                                ({chartData.length} meses analisados)
                            </span>
                        </div>
                    </div>
                    <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={2} />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#64748b' }} 
                                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                    width={65}
                                />
                                <RechartsTooltip 
                                    formatter={(value) => formatCurrency(value)}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11px', padding: '6px 10px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                                <Bar dataKey="entrega" name="Entrega Original" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={28} />
                                <Bar dataKey="pcp" name="Data PCP" fill="#06b6d4" radius={[3, 3, 0, 0]} maxBarSize={28} />
                                <Bar dataKey="prevFat" name="Prev. Faturamento" fill="#4f46e5" radius={[3, 3, 0, 0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 3. HIGH DENSITY FINANCIAL KPI STRIP (ZERO WHITE SPACE) */}
            <div className="px-3 py-2 grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0 bg-slate-100/60 border-b border-slate-200">
                {/* A Faturar */}
                <div className="bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider">A Faturar (Pendente)</span>
                        <span className="text-base sm:text-lg font-black text-indigo-950 font-mono mt-0.5 block leading-none">
                            {formatCurrency(totals.totalPendente)}
                        </span>
                    </div>
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                </div>

                {/* Já Faturado */}
                <div className="bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Já Faturado</span>
                        <span className="text-base sm:text-lg font-black text-emerald-950 font-mono mt-0.5 block leading-none">
                            {formatCurrency(totals.totalFaturado)}
                        </span>
                    </div>
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                        <CheckCircle className="h-4 w-4" />
                    </div>
                </div>

                {/* Total Geral */}
                <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Geral</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5 block leading-none">
                            {formatCurrency(totals.totalGeral)}
                        </span>
                    </div>
                    <div className="p-1.5 bg-slate-100 text-slate-700 rounded-md">
                        <DollarSign className="h-4 w-4" />
                    </div>
                </div>

                {/* Progresso Concluído */}
                <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
                    <div className="flex-1 pr-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Faturado</span>
                            <span className="text-xs font-black text-slate-800 font-mono">
                                {totals.totalGeral > 0 ? Math.round((totals.totalFaturado / totals.totalGeral) * 100) : 0}%
                            </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                                style={{ width: `${totals.totalGeral > 0 ? (totals.totalFaturado / totals.totalGeral) * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {totals.itemsCount} itens
                    </span>
                </div>
            </div>

            {/* 4. PAINEL DE FITA DIÁRIA / TIMELINE COMPACTA (QUANDO AGRUPADO POR PREVISÃO/PCP) */}
            {dailyTimelineData.length > 0 && (
                <div className="px-3 py-2 bg-white border-b border-slate-200 shrink-0 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Fita Diária de Faturamento</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                                (Clique no dia para rolar e abrir os detalhes)
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pico de Volume
                            </span>
                        </div>
                    </div>

                    <div 
                        ref={timelineContainerRef}
                        className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-300"
                    >
                        {dailyTimelineData.map(day => {
                            const isSelected = !!expandedGroups[day.key];
                            return (
                                <div
                                    key={day.key}
                                    onClick={() => handleScrollToGroup(day.key)}
                                    className={`shrink-0 min-w-[145px] max-w-[160px] p-2 rounded-lg border transition-all cursor-pointer select-none ${
                                        isSelected 
                                            ? 'bg-indigo-50/70 border-indigo-400 shadow-xs' 
                                            : day.isPeak
                                                ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
                                                : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
                                    }`}
                                >
                                    {/* Header do card com Dia da semana */}
                                    <div className="flex items-center justify-between text-[11px] leading-tight mb-1">
                                        <div className="flex items-center gap-1">
                                            <span className={`font-bold uppercase ${day.weekDay === 'Sáb' || day.weekDay === 'Dom' ? 'text-rose-600' : 'text-slate-700'}`}>
                                                {day.weekDay}
                                            </span>
                                            <span className="font-mono text-slate-500">{day.shortDate}</span>
                                        </div>
                                        {day.isPeak ? (
                                            <span className="p-0.5 bg-amber-100 text-amber-700 rounded" title="Dia com alto volume de faturamento">
                                                <Flame className="h-3 w-3" />
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono text-slate-400">
                                                {day.items.length} un
                                            </span>
                                        )}
                                    </div>

                                    {/* Valor pendente do dia */}
                                    <div className="text-xs font-black font-mono text-emerald-800 leading-tight">
                                        {formatCurrency(day.totalPendente)}
                                    </div>

                                    {/* Barra e acumulado */}
                                    <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                                        <span>Acumulado:</span>
                                        <span className="font-bold text-slate-600">
                                            {formatShortCurrency(day.runningAccumulator)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1 mt-1 overflow-hidden">
                                        <div 
                                            className={`h-1 rounded-full ${day.isPeak ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${day.intensityPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 5. MAIN SCROLLABLE LIST OF GROUPS (CHRONOLOGICAL DENSE ACCORDIONS) */}
            <div className="flex-1 overflow-auto p-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-xs">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-2"></div>
                        <span className="text-slate-500 font-medium text-xs">Consolidando visão financeira...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-rose-200 shadow-xs text-rose-600">
                        <AlertCircle className="h-10 w-10 mb-2" />
                        <span className="font-bold text-sm">Erro ao carregar dados</span>
                        <p className="text-xs text-slate-400 mt-1">{error}</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 shadow-xs text-slate-400">
                        <AlertCircle className="h-8 w-8 mb-1.5 text-slate-300" />
                        <span className="text-xs">Nenhum item corresponde aos filtros selecionados.</span>
                    </div>
                ) : grouping === 'sem_agrupamento' ? (
                    /* Flat table when no grouping selected */
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 uppercase flex items-center gap-1.5">
                            <List className="h-4 w-4 text-slate-500" /> Itens Listados ({filteredRows.length})
                        </div>
                        <div className="overflow-auto max-h-[calc(100vh-320px)]">
                            <FlatDetailsTable items={filteredRows} formatCurrency={formatCurrency} />
                        </div>
                    </div>
                ) : (
                    /* DENSE FULL-WIDTH CHRONOLOGICAL ACCORDIONS */
                    <div className="flex flex-col gap-1.5 pb-16">
                        {groups.map(group => {
                            const isExpanded = !!expandedGroups[group.key];
                            const percentBilled = group.totalGeral > 0 ? Math.round((group.totalFaturado / group.totalGeral) * 100) : 0;
                            
                            return (
                                <div 
                                    key={group.key} 
                                    id={`group-row-${group.key}`}
                                    className={`bg-white rounded-lg border transition-all duration-150 flex flex-col ${
                                        isExpanded 
                                            ? 'border-indigo-300 shadow-sm ring-1 ring-indigo-200/50' 
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                    }`}
                                >
                                    {/* COMPACT ACCORDION HEADER (~38px) */}
                                    <div 
                                        onClick={() => toggleGroup(group.key)}
                                        className="px-3 py-2 cursor-pointer flex items-center justify-between select-none"
                                    >
                                        {/* Left: Icon, Date/Name, Item count */}
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="text-slate-400 hover:text-indigo-600 transition-colors">
                                                <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-600' : ''}`} />
                                            </div>
                                            <div className="p-1 bg-slate-100 rounded text-slate-600 shrink-0">
                                                {getGroupIcon()}
                                            </div>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-bold text-slate-800 text-xs sm:text-sm truncate" title={group.label}>
                                                    {group.label}
                                                </span>
                                                {group.weekDay && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${group.weekDay === 'Sáb' || group.weekDay === 'Dom' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {group.weekDay}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                                    {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {/* Right: Values aligned in a single dense row */}
                                        <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                                            {/* Progress / Percent */}
                                            <div className="hidden sm:flex items-center gap-1.5">
                                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div 
                                                        className="bg-emerald-500 h-1.5 rounded-full" 
                                                        style={{ width: `${percentBilled}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${percentBilled >= 100 ? 'bg-emerald-100 text-emerald-700' : percentBilled > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                                    {percentBilled}%
                                                </span>
                                            </div>

                                            {/* Pendente / A Faturar (Destaque Principal) */}
                                            <div className="text-right">
                                                <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block sm:hidden">A Faturar</span>
                                                <span className="font-black text-indigo-900 text-xs sm:text-sm">
                                                    {formatCurrency(group.totalPendente)}
                                                </span>
                                            </div>

                                            {/* Já Faturado (Secundário) */}
                                            <div className="text-right hidden md:block border-l border-slate-200 pl-3">
                                                <span className="text-slate-400 text-[10px] mr-1">Fat:</span>
                                                <span className="font-semibold text-emerald-800">
                                                    {formatCurrency(group.totalFaturado)}
                                                </span>
                                            </div>

                                            {/* Total Geral */}
                                            <div className="text-right hidden lg:block border-l border-slate-200 pl-3 text-slate-600">
                                                <span className="text-slate-400 text-[10px] mr-1">Tot:</span>
                                                <span className="font-semibold">
                                                    {formatCurrency(group.totalGeral)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* EXPANDED INNER TABLE */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 overflow-hidden bg-slate-50/30 rounded-b-lg">
                                            <div className="overflow-auto max-h-[420px] bg-white">
                                                <FlatDetailsTable items={group.items} formatCurrency={formatCurrency} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL DE FEEDBACK DE PROGRESSO EM TEMPO REAL */}
            {exportProgress !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
                        {/* Header com ícone e títulos */}
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 border border-emerald-100">
                                <FileSpreadsheet className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                                    <span>Gerando Planilha Lynx</span>
                                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                                        ExcelJS
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                    Padrão Corporativo Oficial • Dados Expandidos
                                </p>
                            </div>
                        </div>

                        {/* Barra de Progresso com Gradiente */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-slate-700">Progresso</span>
                                <span className="font-mono font-bold text-indigo-700 text-sm">
                                    {exportProgress.percent}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 p-0.5">
                                <div 
                                    className="bg-gradient-to-r from-blue-900 via-blue-600 to-emerald-500 h-full rounded-full transition-all duration-200 ease-out shadow-xs"
                                    style={{ width: `${Math.min(100, Math.max(0, exportProgress.percent))}%` }}
                                />
                            </div>
                        </div>

                        {/* Contador de Itens e Status da Etapa */}
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs space-y-1.5">
                            <div className="flex justify-between text-slate-600">
                                <span>Itens Processados:</span>
                                <span className="font-mono font-bold text-slate-800">
                                    {exportProgress.current.toLocaleString('pt-BR')} de {exportProgress.total.toLocaleString('pt-BR')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-slate-600">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                                <span className="text-[11px] font-medium text-slate-700 leading-tight">
                                    {exportProgress.stepMessage}
                                </span>
                            </div>
                        </div>

                        {/* Rodapé informativo */}
                        <p className="text-[10px] text-slate-400 text-center italic">
                            Aguarde... o arquivo será baixado automaticamente ao concluir.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Internal table detail rendering
const FlatDetailsTable = ({ items, formatCurrency }) => {
    const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });
    const [columnFilters, setColumnFilters] = useStickyState({}, '@lynxems:financial_table_colFilters');

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
        if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.substring(0, 10).replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
        if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, '/');
        return raw;
    };

    const sortedAndFilteredItems = useMemo(() => {
        let result = items;

        Object.keys(columnFilters).forEach(key => {
            const filterValue = (columnFilters[key] || '').toLowerCase();
            if (filterValue) {
                result = result.filter(r => {
                    if (key === 'data_prevista_faturamento') return String(formatProtheusDate(r[key]) || '').toLowerCase().includes(filterValue);
                    return String(r[key] || '').toLowerCase().includes(filterValue);
                });
            }
        });

        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                const numericFields = ['valor_unitario', 'valor_total', 'quantidade', 'qtd_entreg', 'qtd_faturar'];
                if (numericFields.includes(sortConfig.key)) {
                    const diff = parseFloat(aValue || 0) - parseFloat(bValue || 0);
                    return sortConfig.direction === 'asc' ? diff : -diff;
                }

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
            <thead className="text-[10px] text-slate-700 uppercase bg-slate-100/80 border-b border-slate-200 font-bold sticky top-0 z-10">
                <tr>
                    <th className="px-2 py-1.5 text-center align-top pt-4">Doc</th>
                    <SortableHeader label="Pedido" columnKey="pedido" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['pedido']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Item" columnKey="item" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['item']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Cód. Produto" columnKey="codigo" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['codigo']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Descrição" columnKey="descricao" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['descricao']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Cliente" columnKey="nome_cliente" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['nome_cliente']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="V. Unitário" columnKey="valor_unitario" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['valor_unitario']} onFilterChange={handleColumnFilterChange} />
                    <th className="px-2 py-1.5 text-right text-indigo-700 bg-indigo-50/40 align-top pt-4">A Faturar (R$)</th>
                    <th className="px-2 py-1.5 text-right text-emerald-700 bg-emerald-50/40 align-top pt-4">Faturado (R$)</th>
                    <SortableHeader label="Total (R$)" columnKey="valor_total" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['valor_total']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Qtd. Solicitada" columnKey="quantidade" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['quantidade']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Qtd. A Faturar" columnKey="qtd_faturar" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['qtd_faturar']} onFilterChange={handleColumnFilterChange} className="text-indigo-700 bg-indigo-50/40" />
                    <SortableHeader label="Qtd. Entregue" columnKey="qtd_entreg" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['qtd_entreg']} onFilterChange={handleColumnFilterChange} className="text-emerald-700 bg-emerald-50/40" />
                    <SortableHeader label="Data PCP" columnKey="data_entrega_pcp" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['data_entrega_pcp']} onFilterChange={handleColumnFilterChange} />
                    <SortableHeader label="Prev. Faturamento" columnKey="data_prevista_faturamento" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['data_prevista_faturamento']} onFilterChange={handleColumnFilterChange} />
                    <th className="px-2 py-1.5 text-center align-top pt-4">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
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
                        <tr key={idx} className={`hover:bg-slate-50/80 ${isBilled ? 'bg-slate-50/40 opacity-75' : 'bg-white'}`}>
                            <td className="px-2 py-1 text-center">
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
                                        title="Visualizar Desenho Técnico"
                                    />
                                ) : (
                                    <FileText className="w-3.5 h-3.5 mx-auto text-slate-300" title="Sem documento" />
                                )}
                            </td>
                            <td className="px-2 py-1 font-bold text-slate-900">{row.pedido}</td>
                            <td className="px-2 py-1 font-mono text-[10px] text-slate-500">{row.item}</td>
                            <td className="px-2 py-1 font-mono text-indigo-700 font-semibold">{row.codigo}</td>
                            <td className="px-2 py-1">
                                <div className="truncate max-w-[140px]" title={row.descricao}>{row.descricao}</div>
                            </td>
                            <td className="px-2 py-1">
                                <div className="truncate max-w-[120px]" title={row.nome_cliente}>{row.nome_cliente}</div>
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-500">{formatCurrency(effectiveValUnit)}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-indigo-900 bg-indigo-50/30">{formatCurrency(qtyFaturar * effectiveValUnit)}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">{formatCurrency(qtyEntreg * effectiveValUnit)}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-slate-950">{formatCurrency(valTotalItem)}</td>
                            
                            <td className="px-2 py-1 text-right font-mono">{qtyTotal.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-indigo-700 bg-indigo-50/30">{qtyFaturar.toLocaleString('pt-BR')}</td>
                            <td className="px-2 py-1 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">{qtyEntreg.toLocaleString('pt-BR')}</td>
                            
                            <td className="px-2 py-1 text-center text-[10px] font-bold text-cyan-700">
                                {row.data_entrega_pcp ? formatProtheusDate(row.data_entrega_pcp) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-2 py-1 text-center text-[10px] font-bold text-teal-700">
                                {row.data_prevista_faturamento ? formatProtheusDate(row.data_prevista_faturamento) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-2 py-1 text-center">
                                {qtyFaturar <= 0 ? (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] uppercase font-bold py-0.5 px-1.5 rounded">Faturado 100%</span>
                                ) : qtyEntreg > 0 ? (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] uppercase font-bold py-0.5 px-1.5 rounded">Fat. Parcial</span>
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
