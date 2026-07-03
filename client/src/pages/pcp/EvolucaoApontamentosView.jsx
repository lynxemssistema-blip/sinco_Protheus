import React, { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, Calendar, User, Cpu, Maximize2, Minimize2,
    Filter, Loader2, Award, BarChart3, Clock, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

export default function EvolucaoApontamentosView({
    globalFilters,
    isEvolutionFullscreen,
    setIsEvolutionFullscreen
}) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ chartData: [], sectors: [], users: [] });
    const [error, setError] = useState(null);

    // Metric Toggle: 'qtd' (Volume de Peças) or 'count' (Frequência/Tarefas)
    const [metric, setMetric] = useState('qtd');

    // Local filters (Sector and Operator/User)
    const [selectedSector, setSelectedSector] = useState('');
    const [selectedUser, setSelectedUser] = useState('');

    // Selected date for detailed list below the chart
    const [selectedDate, setSelectedDate] = useState(null);

    // Hovered bar index for SVG tooltip
    const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Fetch data from `/api/production/analytics/evolution`
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                startDate: globalFilters.planned_date_start || '',
                endDate: globalFilters.planned_date_end || '',
                sector: selectedSector,
                user: selectedUser
            };
            const res = await api.get('/production/analytics/evolution', { params });
            setData(res.data || { chartData: [], sectors: [], users: [] });
            
            // Auto-select the first available date or reset selected date if not present anymore
            if (res.data?.chartData?.length > 0) {
                // Keep selected date if still in the new chart data, else select the last day
                const datesInNewData = res.data.chartData.map(d => d.date);
                if (selectedDate && !datesInNewData.includes(selectedDate)) {
                    setSelectedDate(datesInNewData[datesInNewData.length - 1]);
                } else if (!selectedDate) {
                    setSelectedDate(datesInNewData[datesInNewData.length - 1]);
                }
            } else {
                setSelectedDate(null);
            }
        } catch (err) {
            console.error('Erro ao buscar evolução de apontamentos:', err);
            setError('Não foi possível carregar os dados de evolução da produção.');
            toast.error('Erro ao carregar dados de evolução.');
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch when global dates or local dropdowns change
    useEffect(() => {
        fetchData();
    }, [
        globalFilters.planned_date_start,
        globalFilters.planned_date_end,
        selectedSector,
        selectedUser
    ]);

    // Computed values for the metric selection
    const chartPoints = useMemo(() => {
        if (!data.chartData) return [];
        return data.chartData.map(item => {
            const val = metric === 'qtd' 
                ? Number(item.total) 
                : item.details.reduce((sum, d) => sum + Number(d.count || 0), 0);
            return {
                date: item.date,
                value: val,
                details: item.details || []
            };
        });
    }, [data.chartData, metric]);

    // Summary Statistics
    const stats = useMemo(() => {
        if (chartPoints.length === 0) {
            return { total: 0, maxVal: 0, maxDate: '--/--/----', avg: 0 };
        }
        let total = 0;
        let maxVal = 0;
        let maxDate = '';
        chartPoints.forEach(p => {
            total += p.value;
            if (p.value > maxVal) {
                maxVal = p.value;
                maxDate = p.date;
            }
        });
        const avg = Math.round(total / chartPoints.length);
        
        const formatD = (dStr) => {
            if (!dStr) return '--';
            const [y, m, d] = dStr.split('-');
            return `${d}/${m}/${y}`;
        };

        return {
            total,
            maxVal,
            maxDate: formatD(maxDate),
            avg
        };
    }, [chartPoints]);

    // Selected Day Details for the grid view
    const selectedDayData = useMemo(() => {
        if (!selectedDate || !chartPoints.length) return null;
        return chartPoints.find(p => p.date === selectedDate) || null;
    }, [selectedDate, chartPoints]);

    // SVG Drawing helpers & layout variables
    const padding = { top: 30, right: 30, bottom: 45, left: 60 };
    const svgWidth = 1000;
    const svgHeight = 350;
    const chartWidth = svgWidth - padding.left - padding.right;
    const chartHeight = svgHeight - padding.top - padding.bottom;

    const maxChartValue = useMemo(() => {
        const vals = chartPoints.map(p => p.value);
        const max = Math.max(...vals, 0);
        return max > 0 ? Math.ceil(max * 1.15) : 100; // Add 15% margin at the top
    }, [chartPoints]);

    // X axis ticks & bar spacing calculation
    const barsCount = chartPoints.length;
    const barWidth = barsCount > 0 ? Math.max(8, Math.min(60, (chartWidth / barsCount) * 0.7)) : 30;
    const groupWidth = barsCount > 0 ? chartWidth / barsCount : chartWidth;

    const getX = (index) => {
        return padding.left + (index * groupWidth) + (groupWidth - barWidth) / 2;
    };

    const getY = (value) => {
        const ratio = value / maxChartValue;
        return padding.top + chartHeight - (ratio * chartHeight);
    };

    const formatDateShort = (dateStr) => {
        if (!dateStr) return '';
        const [, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    };

    const formatFullDate = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <div className={`flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300 ${
            isEvolutionFullscreen 
                ? 'fixed inset-0 z-[9999] p-6 bg-slate-50 overflow-auto' 
                : 'flex-1 min-h-0 mt-4'
        }`}>
            {/* Header section with titles and tools */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-650 border border-emerald-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Evolução de Apontamentos Diários</h2>
                        <p className="text-xs text-slate-500">
                            Acompanhamento diário da produtividade global, filtrado e agrupado em tempo real.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Metric Select Buttons */}
                    <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 shrink-0">
                        <button
                            onClick={() => { setMetric('qtd'); setHoveredBarIndex(null); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                metric === 'qtd'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Volume de Peças
                        </button>
                        <button
                            onClick={() => { setMetric('count'); setHoveredBarIndex(null); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                metric === 'count'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Frequência (Tarefas)
                        </button>
                    </div>

                    {/* Sector Filter */}
                    <div className="flex items-center gap-1.5">
                        <label htmlFor="sector-filter" className="text-[10px] uppercase font-bold text-slate-400">Setor:</label>
                        <select
                            id="sector-filter"
                            aria-label="Filtrar por Setor"
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-semibold outline-none focus:border-blue-500 transition-all cursor-pointer min-w-[120px]"
                        >
                            <option value="">Todos</option>
                            {data.sectors?.map(s => (
                                <option key={s.id} value={s.id}>{s.nome}</option>
                            ))}
                        </select>
                    </div>

                    {/* Operator Filter */}
                    <div className="flex items-center gap-1.5">
                        <label htmlFor="user-filter" className="text-[10px] uppercase font-bold text-slate-400">Operador:</label>
                        <select
                            id="user-filter"
                            aria-label="Filtrar por Operador"
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-semibold outline-none focus:border-blue-500 transition-all cursor-pointer min-w-[120px]"
                        >
                            <option value="">Todos</option>
                            {data.users?.map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>

                    {/* Full-screen Toggle */}
                    <button
                        onClick={() => setIsEvolutionFullscreen(!isEvolutionFullscreen)}
                        className="p-2 border border-slate-200 hover:bg-slate-100 hover:scale-105 active:scale-95 rounded-lg transition-all text-slate-600 bg-white flex items-center justify-center shadow-sm ml-auto lg:ml-0"
                        title={isEvolutionFullscreen ? 'Sair da Tela Inteira' : 'Ver em Tela Inteira'}
                    >
                        {isEvolutionFullscreen ? (
                            <Minimize2 className="w-4.5 h-4.5" />
                        ) : (
                            <Maximize2 className="w-4.5 h-4.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* KPI Cards Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 shrink-0 bg-white border-b border-slate-200">
                {/* Total Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex items-center gap-4">
                    <div className={`p-3 rounded-lg flex items-center justify-center ${
                        metric === 'qtd' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                        {metric === 'qtd' ? <BarChart3 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {metric === 'qtd' ? 'Total de Peças' : 'Total de Apontamentos'}
                        </div>
                        <div className="text-xl font-extrabold text-slate-800">
                            {stats.total.toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>

                {/* Average Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 border border-indigo-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Média Diária</div>
                        <div className="text-xl font-extrabold text-slate-800">
                            {stats.avg.toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>

                {/* Max Day Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden flex items-center gap-4 col-span-1 md:col-span-2">
                    <div className="bg-amber-50 p-3 rounded-lg text-amber-600 border border-amber-100 flex items-center justify-center">
                        <Award className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recorde de Produção (Período)</div>
                        <div className="text-sm font-bold text-slate-700 flex items-center gap-2 mt-0.5">
                            <span>Dia {stats.maxDate}:</span>
                            <span className="font-extrabold text-slate-900 bg-amber-100 px-1.5 py-0.5 rounded text-xs border border-amber-200">
                                {stats.maxVal.toLocaleString('pt-BR')} {metric === 'qtd' ? 'peças' : 'apontamentos'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SVG Content Area */}
            <div className="flex-1 bg-white p-6 flex flex-col justify-center items-center min-h-[350px] relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col justify-center items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="text-xs font-bold text-slate-600">Buscando histórico...</span>
                    </div>
                )}

                {error && !loading && (
                    <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                        <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                        <p className="font-bold text-slate-700 text-sm">{error}</p>
                        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm">
                            Tentar Novamente
                        </button>
                    </div>
                )}

                {!error && !loading && chartPoints.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 font-semibold max-w-sm">
                        <Calendar className="w-12 h-12 text-slate-350 mb-3" />
                        <p className="text-sm text-slate-500 font-bold">Nenhum apontamento no período selecionado.</p>
                        <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de data no topo da página ou selecione outros filtros locais.</p>
                    </div>
                )}

                {!error && !loading && chartPoints.length > 0 && (
                    <div className="w-full max-w-5xl select-none relative">
                        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
                            {/* Definitions for Gradients */}
                            <defs>
                                <linearGradient id="blueCyanGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.95" />
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
                                </linearGradient>
                                <linearGradient id="emeraldTealGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#059669" stopOpacity="0.95" />
                                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0.8" />
                                </linearGradient>
                                <linearGradient id="hoverGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.95" />
                                </linearGradient>
                            </defs>

                            {/* Horizontal Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                const val = Math.round(ratio * maxChartValue);
                                const yPos = padding.top + chartHeight - (ratio * chartHeight);
                                return (
                                    <g key={i} className="opacity-45">
                                        <line
                                            x1={padding.left}
                                            y1={yPos}
                                            x2={svgWidth - padding.right}
                                            y2={yPos}
                                            stroke="#e2e8f0"
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
                                        />
                                        <text
                                            x={padding.left - 12}
                                            y={yPos + 4}
                                            textAnchor="end"
                                            className="font-mono text-[10px] fill-slate-400 font-bold"
                                        >
                                            {val.toLocaleString('pt-BR')}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Bars & Interactive nodes */}
                            {chartPoints.map((item, idx) => {
                                const barX = getX(idx);
                                const barY = getY(item.value);
                                const itemHeight = Math.max(2, padding.top + chartHeight - barY);
                                const isSelected = item.date === selectedDate;
                                const isHovered = idx === hoveredBarIndex;

                                // Determine bar color gradient
                                let fill = metric === 'qtd' ? 'url(#blueCyanGrad)' : 'url(#emeraldTealGrad)';
                                if (isHovered) fill = 'url(#hoverGrad)';

                                return (
                                    <g key={idx}>
                                        {/* Main Visible Bar with rounded top corners */}
                                        <rect
                                            x={barX}
                                            y={barY}
                                            width={barWidth}
                                            height={itemHeight}
                                            fill={fill}
                                            rx={barWidth > 12 ? 4 : 2}
                                            ry={barWidth > 12 ? 4 : 2}
                                            className="transition-all duration-150 cursor-pointer"
                                            stroke={isSelected ? '#1e293b' : 'none'}
                                            strokeWidth={isSelected ? 2 : 0}
                                            onClick={() => setSelectedDate(item.date)}
                                            onMouseEnter={(e) => {
                                                setHoveredBarIndex(idx);
                                                const svgElem = e.currentTarget.ownerSVGElement;
                                                const rectBounds = e.currentTarget.getBoundingClientRect();
                                                const svgBounds = svgElem.getBoundingClientRect();
                                                // Compute relative position inside the SVG element
                                                const x = rectBounds.left - svgBounds.left + barWidth / 2;
                                                const y = rectBounds.top - svgBounds.top - 12;
                                                setTooltipPos({ x, y });
                                            }}
                                            onMouseLeave={() => setHoveredBarIndex(null)}
                                        />

                                        {/* Invisible wide interactive overlay to make hover easier */}
                                        <rect
                                            x={padding.left + (idx * groupWidth)}
                                            y={padding.top}
                                            width={groupWidth}
                                            height={chartHeight}
                                            fill="transparent"
                                            className="cursor-pointer"
                                            onClick={() => setSelectedDate(item.date)}
                                            onMouseEnter={(e) => {
                                                setHoveredBarIndex(idx);
                                                const svgElem = e.currentTarget.ownerSVGElement;
                                                const barLeft = getX(idx);
                                                const barTop = getY(item.value);
                                                
                                                // Create a temporary group element to measure bounds correctly or use math
                                                const svgBounds = svgElem.getBoundingClientRect();
                                                const ratioX = svgBounds.width / svgWidth;
                                                const ratioY = svgBounds.height / svgHeight;
                                                
                                                setTooltipPos({
                                                    x: (barLeft + barWidth / 2) * ratioX,
                                                    y: (barTop - 12) * ratioY
                                                });
                                            }}
                                            onMouseLeave={() => setHoveredBarIndex(null)}
                                        />

                                        {/* Date tick below each bar */}
                                        {barsCount <= 15 || idx % Math.ceil(barsCount / 15) === 0 ? (
                                            <text
                                                x={barX + barWidth / 2}
                                                y={padding.top + chartHeight + 18}
                                                textAnchor="middle"
                                                className={`text-[10px] font-bold ${
                                                    isSelected ? 'fill-slate-800 font-extrabold scale-105' : 'fill-slate-400'
                                                }`}
                                            >
                                                {formatDateShort(item.date)}
                                            </text>
                                        ) : null}
                                    </g>
                                );
                            })}

                            {/* Base horizontal axis line */}
                            <line
                                x1={padding.left}
                                y1={padding.top + chartHeight}
                                x2={svgWidth - padding.right}
                                y2={padding.top + chartHeight}
                                stroke="#cbd5e1"
                                strokeWidth="2.5"
                            />
                        </svg>

                        {/* Floating Tooltip Component */}
                        {hoveredBarIndex !== null && chartPoints[hoveredBarIndex] && (
                            <div
                                className="absolute bg-slate-900 text-white rounded-lg p-2.5 shadow-xl text-xs z-[999] pointer-events-none flex flex-col gap-1 border border-slate-800 animate-in fade-in zoom-in-95 duration-100"
                                style={{
                                    left: `${tooltipPos.x}px`,
                                    top: `${tooltipPos.y}px`,
                                    transform: 'translate(-50%, -100%)',
                                    marginTop: '-8px'
                                }}
                            >
                                <div className="font-bold border-b border-slate-800 pb-1 text-[10px] text-slate-400 uppercase tracking-wide">
                                    {formatFullDate(chartPoints[hoveredBarIndex].date)}
                                </div>
                                <div className="font-extrabold text-sm text-emerald-450 mt-0.5">
                                    {chartPoints[hoveredBarIndex].value.toLocaleString('pt-BR')}{' '}
                                    <span className="font-normal text-slate-350 text-xs">
                                        {metric === 'qtd' ? 'peças' : 'apontamentos'}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                    Clique para detalhar este dia
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Detailed list section showing who produced what on the selected day */}
            {selectedDayData && (
                <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                                Detalhamento de Operações — Dia {formatFullDate(selectedDate)}
                            </h3>
                            <span className="text-[10px] font-bold text-slate-450 px-2 py-0.5 rounded bg-slate-200/60 border border-slate-300/40 text-slate-600">
                                {selectedDayData.details.length} logs de apontamento
                            </span>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden overflow-x-auto max-h-56 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2.5 pl-4">Operador</th>
                                        <th className="p-2.5">Setor de Atuação</th>
                                        <th className="p-2.5 text-right">Volume Produzido</th>
                                        <th className="p-2.5 text-right pr-4">Apontamentos Realizados</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedDayData.details.map((log, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/55 transition-colors">
                                            <td className="p-2.5 pl-4 font-bold text-slate-800 flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-extrabold text-[10px] flex items-center justify-center border border-slate-200">
                                                    {log.usuario ? log.usuario.substring(0, 2).toUpperCase() : '?'}
                                                </div>
                                                <span>{log.usuario || 'Desconhecido'}</span>
                                            </td>
                                            <td className="p-2.5 font-semibold text-slate-650">
                                                {log.setor || 'Sem Setor'}
                                            </td>
                                            <td className="p-2.5 text-right font-extrabold text-blue-600">
                                                {Number(log.qtd).toLocaleString('pt-BR')} peças
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-slate-700 pr-4">
                                                {Number(log.count).toLocaleString('pt-BR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
