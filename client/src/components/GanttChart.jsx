import React, { useState, useRef, useEffect } from 'react';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function GanttChart({ data, hierarchyData, expandedNodes, onPlanClick }) {
    const [timelineStart, setTimelineStart] = useState(new Date());
    const [timelineEnd, setTimelineEnd] = useState(addDays(new Date(), 90));

    const dayWidth = 30; // pixels per day

    // Calculate timeline range from data
    useEffect(() => {
        if (data.length > 0) {
            const dates = data.flatMap(d => [
                d.data_planejada_inicio,
                d.data_planejada_fim,
                d.data_real_inicio,
                d.data_real_fim
            ]).filter(Boolean).map(d => new Date(d));

            if (dates.length > 0) {
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));
                setTimelineStart(startOfMonth(addDays(minDate, -30)));
                setTimelineEnd(endOfMonth(addDays(maxDate, 30)));
            }
        }
    }, [data]);

    const totalDays = differenceInDays(timelineEnd, timelineStart);
    const timelineWidth = totalDays * dayWidth;

    // Render timeline header
    const renderTimelineHeader = () => {
        const months = [];
        let current = startOfMonth(timelineStart);

        while (current <= timelineEnd) {
            const monthEnd = endOfMonth(current);
            const daysInView = differenceInDays(
                monthEnd < timelineEnd ? monthEnd : timelineEnd,
                current < timelineStart ? timelineStart : current
            ) + 1;

            months.push({
                date: current,
                label: format(current, 'MMMM yyyy', { locale: ptBR }),
                width: daysInView * dayWidth
            });

            current = addDays(monthEnd, 1);
        }

        return (
            <div className="sticky top-0 bg-white border-b-2 border-slate-300 z-10">
                {/* Month Headers */}
                <div className="flex border-b border-slate-200">
                    {months.map((m, i) => (
                        <div key={i} style={{ width: m.width }} className="border-r border-slate-200 p-2 text-center font-bold text-sm">
                            {m.label}
                        </div>
                    ))}
                </div>

                {/* Day Numbers */}
                <div className="flex text-xs text-slate-600">
                    {eachDayOfInterval({ start: timelineStart, end: timelineEnd }).map((day, i) => (
                        <div key={i} style={{ width: dayWidth }} className="border-r border-slate-100 p-1 text-center">
                            {format(day, 'd')}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Flatten hierarchy to visible items based on expanded state
    const flattenHierarchy = (hierarchy) => {
        const items = [];

        hierarchy.forEach(pedido => {
            items.push({ type: 'pedido', data: pedido });

            if (expandedNodes.has(pedido.id)) {
                pedido.items.forEach(item => {
                    items.push({ type: 'item', data: item });

                    if (expandedNodes.has(item.id)) {
                        item.ops.forEach(op => {
                            items.push({ type: 'op', data: op });

                            if (expandedNodes.has(op.id)) {
                                op.processos.forEach(processo => {
                                    items.push({ type: 'processo', data: processo });
                                });
                            }
                        });
                    }
                });
            }
        });

        return items;
    };

    const visibleItems = flattenHierarchy(hierarchyData);

    // Calculate bar position
    const getBarPosition = (startDate, endDate) => {
        if (!startDate || !endDate) return null;

        const start = new Date(startDate);
        const end = new Date(endDate);

        const left = differenceInDays(start, timelineStart) * dayWidth;
        const width = (differenceInDays(end, start) + 1) * dayWidth;

        return { left, width };
    };

    // Get height for each row type
    const getRowHeight = (type) => {
        switch (type) {
            case 'pedido': return 'h-10';
            case 'item': return 'h-8';
            case 'op': return 'h-8';
            case 'processo': return 'h-12';
            default: return 'h-8';
        }
    };

    // Render Gantt bars for a processo
    const renderProcessoBars = (processo) => {
        const planned = getBarPosition(processo.data_planejada_inicio, processo.data_planejada_fim);
        const actual = getBarPosition(processo.data_real_inicio, processo.data_real_fim);

        // Calculate status color for actual bar
        const getActualBarColor = () => {
            if (!actual) return 'transparent';
            if (!planned) return 'bg-blue-600'; // In progress without plan

            const planned_days = differenceInDays(new Date(processo.data_planejada_fim), new Date(processo.data_planejada_inicio));
            const actual_days = differenceInDays(new Date(processo.data_real_fim), new Date(processo.data_real_inicio));
            const delay = actual_days - planned_days;
            const delay_percent = planned_days > 0 ? (delay / planned_days) * 100 : 0;

            if (delay_percent <= 0) return 'bg-green-500'; // On time or early
            if (delay_percent <= 20) return 'bg-yellow-400'; // Minor delay
            return 'bg-red-500'; // Major delay
        };

        return (
            <div className="relative">
                {/* Planned Bar (Superior) */}
                {planned && (
                    <div
                        className="absolute top-1 h-4 bg-blue-300 border border-blue-500 rounded cursor-pointer hover:bg-blue-400"
                        style={{ left: planned.left, width: planned.width }}
                        title={`Planejado: ${format(new Date(processo.data_planejada_inicio), 'dd/MM/yyyy')} - ${format(new Date(processo.data_planejada_fim), 'dd/MM/yyyy')}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlanClick && onPlanClick(processo);
                        }}
                    >
                        <div className="text-[10px] text-blue-900 px-1 truncate">Planejado</div>
                    </div>
                )}

                {/* Actual Bar (Inferior) */}
                {actual && (
                    <div
                        className={`absolute top-6 h-4 ${getActualBarColor()} border border-slate-600 rounded`}
                        style={{ left: actual.left, width: actual.width }}
                        title={`Real: ${format(new Date(processo.data_real_inicio), 'dd/MM/yyyy')} - ${format(new Date(processo.data_real_fim), 'dd/MM/yyyy')}`}
                    >
                        <div className="text-[10px] text-white px-1 truncate">Real</div>
                    </div>
                )}

                {/* No data indicator */}
                {!planned && !actual && (
                    <div className="absolute top-4 left-2 text-xs text-slate-400 italic cursor-pointer hover:text-blue-600"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlanClick && onPlanClick(processo);
                        }}>
                        Não planejado - Clique para planejar
                    </div>
                )}
            </div>
        );
    };

    const renderRow = (item) => {
        const heightClass = getRowHeight(item.type);

        if (item.type === 'processo') {
            return (
                <div className={`${heightClass} border-b border-slate-100 relative`}>
                    {renderProcessoBars(item.data)}
                </div>
            );
        }

        // For non-processo rows, show empty space with same height
        return <div className={`${heightClass} border-b border-slate-100 bg-slate-50`}></div>;
    };

    return (
        <div className="h-full flex flex-col">
            {/* Timeline Header */}
            <div style={{ width: timelineWidth }}>
                {renderTimelineHeader()}
            </div>

            {/* Gantt Rows */}
            <div className="flex-1 overflow-y-auto" style={{ width: timelineWidth }}>
                {visibleItems.map((item, index) => (
                    <div key={item.data.id || index}>
                        {renderRow(item)}
                    </div>
                ))}
            </div>
        </div>
    );
}
