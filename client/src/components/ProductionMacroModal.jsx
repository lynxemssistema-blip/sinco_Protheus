import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, GripVertical, MoveUp, MoveDown, Briefcase, Globe, Plus, Minus, Link } from 'lucide-react';
import { useHelp } from '../contexts/HelpContext';

export default function ProductionMacroModal({ op, operations, onClose, onSaveBatch }) {

    const [operationPlans, setOperationPlans] = useState({}); 
    const [expandedOps, setExpandedOps] = useState({});
    const [loading, setLoading] = useState(false);
    
    // Help Context Injection
    const { setForcedPath } = useHelp();

    useEffect(() => {
        setForcedPath('/planejamento-sequencial');
        return () => setForcedPath(null);
    }, [setForcedPath]);
    
    // Configurações e Datas Alvo
    const [calcDirection, setCalcDirection] = useState('backward'); // backward = começa do fim; forward = começa do inicio
    const [targetEndDate, setTargetEndDate] = useState('');
    const [targetStartDate, setTargetStartDate] = useState('');
    const [daysMode, setDaysMode] = useState('calendar'); // 'calendar' ou 'business'
    const [includeST, setIncludeST] = useState(false); // Default: don't include ST
    const [includeSaturday, setIncludeSaturday] = useState(false); // Consider Saturday as workday
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'gantt'
    const [draggingBar, setDraggingBar] = useState(null); // { code, startX, offsetDays }

    // Estrutura
    const [orderedGroups, setOrderedGroups] = useState([]);
    const [joinedIndices, setJoinedIndices] = useState(new Set()); 
    const [draggedIndex, setDraggedIndex] = useState(null);

    const PREF_KEY = `macroPref_${op.op}`;

    // 1. Agrupamento Inicial por Recurso
    const groupedByRecurso = useMemo(() => {
        const groups = {};
        operations.forEach(o => {
            const recursoCode = (o.recurso && o.recurso.trim() !== '') ? o.recurso.trim() : (o.operacao ? `OP-${o.operacao}` : 'S/R');
            if (!groups[recursoCode]) {
                groups[recursoCode] = {
                    code: recursoCode,
                    desc: o.desc_recurso || o.desc_operacao || '',
                    items: [],
                    min_sequen: 999999
                };
            }
            groups[recursoCode].items.push(o);
            const seq = Number(o.sequen) || 999999;
            if (seq < groups[recursoCode].min_sequen) groups[recursoCode].min_sequen = seq;
        });
        
        Object.values(groups).forEach(g => {
            const descricoes = Array.from(new Set(g.items.map(i => i.desc_recurso || i.desc_operacao).filter(Boolean)));
            g.desc = descricoes.join(' + ') || 'Sem descrição';
        });

        return Object.values(groups).sort((a, b) => a.min_sequen - b.min_sequen);
    }, [operations]);

    // 2. Inicialização do Estado (Lê Baseline do Banco + Lê Layout Local)
    useEffect(() => {
        const initialPlans = {};
        const initialExpanded = {};
        let initialEndDate = '';
        let initialStartDate = '';

        // Copia local para não afetar o state ate o final
        let groupsToUse = [...groupedByRecurso];
        let savedDirection = 'backward';

        try {
            const saved = localStorage.getItem(PREF_KEY);
            if (saved) {
                const prefs = JSON.parse(saved);
                if (prefs.dir) savedDirection = prefs.dir;
                if (prefs.layout && Array.isArray(prefs.layout)) {
                    // Reordena groupsToUse com base no array de IDs layout
                    const sorted = [];
                    prefs.layout.forEach(code => {
                        const idx = groupsToUse.findIndex(g => g.code === code);
                        if (idx >= 0) sorted.push(groupsToUse.splice(idx, 1)[0]);
                    });
                    groupsToUse = [...sorted, ...groupsToUse]; // Adiciona os que não estavam no layout no fim
                }
            }
        } catch (e) {
            console.warn('Erro ao ler macro prefs', e);
        }

        groupsToUse.forEach(group => {
            let existingStart = '';
            let existingEnd = '';
            let dur = 0;

            const plannedItem = group.items.find(i => i.data_planejada_inicio && i.data_planejada_fim);
            if (plannedItem) {
                existingStart = new Date(plannedItem.data_planejada_inicio).toISOString().split('T')[0];
                existingEnd = new Date(plannedItem.data_planejada_fim).toISOString().split('T')[0];
                const s = new Date(existingStart);
                const e = new Date(existingEnd);
                // Usa dias úteis (sem sábado) como duração padrão — mais preciso para planejamento
                dur = Math.max(1, countBusinessDays(s, e, false));

                if (!initialEndDate || existingEnd > initialEndDate) initialEndDate = existingEnd;
                if (!initialStartDate || existingStart < initialStartDate) initialStartDate = existingStart;
            }

            initialPlans[group.code] = {
                start: existingStart,
                end: existingEnd,
                baselineStart: existingStart, // Ponto de ancoragem para UI (MS Project Baseline)
                baselineEnd: existingEnd,
                duracao: dur,
                selected: true
            };
            initialExpanded[group.code] = false;
        });

        setOperationPlans(initialPlans);
        setExpandedOps(initialExpanded);
        setOrderedGroups(groupsToUse);
        setCalcDirection(savedDirection);
        
        if (initialEndDate) setTargetEndDate(initialEndDate);
        if (initialStartDate) setTargetStartDate(initialStartDate);
    }, [groupedByRecurso, PREF_KEY]);


    // 3. Utilitários de Data
    const subtractDays = (date, days, mode, incSat = false) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() - 1);
            if (mode === 'business') {
                const day = result.getDay();
                if (day !== 0 && (incSat || day !== 6)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    const addDays = (date, days, mode, incSat = false) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() + 1);
            if (mode === 'business') {
                const day = result.getDay();
                if (day !== 0 && (incSat || day !== 6)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    // Normaliza uma data para o dia útil mais próximo (evita domingo/sábado como âncora)
    const skipToWorkday = (date, forward, incSat) => {
        const result = new Date(date);
        const day = result.getDay();
        if (day === 0) { // Domingo → sempre pula
            result.setDate(result.getDate() + (forward ? 1 : -2));
        } else if (!incSat && day === 6) { // Sábado (quando não incluído)
            result.setDate(result.getDate() + (forward ? 2 : -1));
        }
        return result;
    };

    // Conta dias úteis entre duas datas (inclusivo)
    const countBusinessDays = (startDate, endDate, incSat) => {
        let count = 0;
        const cur = new Date(startDate);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && (incSat || day !== 6)) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    };

    // 4. Lógicas de Cálculo Sequencial
    const calcRoutine = (params) => {
        const { isForward, anchorDate, plansList, targetGroups, joinedSet, incST, incSat } = params;
        if (!anchorDate) return plansList;

        const newPlans = { ...plansList };

        // Se forward: processa do index [0 -> N]
        // Se backward: processa do index [N -> 0]
        const indices = isForward
            ? [...Array(targetGroups.length).keys()]
            : [...Array(targetGroups.length).keys()].reverse();

        // Normaliza a data âncora — impede que domingo/sábado seja início/fim de operação
        let currentDate = daysMode === 'business'
            ? skipToWorkday(new Date(anchorDate), isForward, incSat)
            : new Date(anchorDate);
        let i = 0;

        while (i < indices.length) {
            const idx = indices[i];
            
            // Identifica o bloco que deve estar "unido" (Junto)
            const blockIndices = [idx];
            let lookAhead = i + 1;

            if (isForward) {
                // Ao calcular da Esquerda p Direita, os unidos andam juntos
                while (lookAhead < indices.length && joinedSet.has(indices[lookAhead - 1])) {
                    blockIndices.push(indices[lookAhead]);
                    lookAhead++;
                }
            } else {
                while (lookAhead < indices.length && joinedSet.has(indices[lookAhead - 1])) {
                    blockIndices.push(indices[lookAhead]);
                    lookAhead++;
                }
            }

            // Ignorar fluxo se for bloco de serviço ST
            const isSTBlock = blockIndices.every(bIdx => targetGroups[bIdx].code.toUpperCase().startsWith('ST'));
            if (!incST && isSTBlock) {
                 i = lookAhead;
                 continue; // Pula cálculos e avanço de data (gap zero, pulo mecânico)
            }

            let maxDur = 0;
            blockIndices.forEach(bIdx => {
                const g = targetGroups[bIdx];
                const p = newPlans[g.code];
                if (p && p.selected) maxDur = Math.max(maxDur, parseInt(p.duracao) || 0);
            });

            const blockAnchorDate = new Date(currentDate);
            let sDate, eDate, nextDate;

            if (isForward) {
                sDate = blockAnchorDate;
                if (maxDur === 0) {
                    eDate = blockAnchorDate;
                    nextDate = blockAnchorDate;
                } else {
                    eDate = addDays(blockAnchorDate, maxDur - 1, daysMode, incSat);
                    nextDate = addDays(blockAnchorDate, maxDur, daysMode, incSat);
                }
            } else {
                eDate = blockAnchorDate;
                if (maxDur === 0) {
                    sDate = blockAnchorDate;
                    nextDate = blockAnchorDate;
                } else {
                    sDate = subtractDays(blockAnchorDate, maxDur - 1, daysMode, incSat);
                    nextDate = subtractDays(blockAnchorDate, maxDur, daysMode, incSat);
                }
            }

            blockIndices.forEach(bIdx => {
                const g = targetGroups[bIdx];
                const p = newPlans[g.code];
                if (p && p.selected) {
                    // Se data final cair em fim de semana, avança para próximo dia útil
                    const normalizedEnd = daysMode === 'business'
                        ? skipToWorkday(new Date(eDate), true, incSat)
                        : eDate;
                    p.start = sDate.toISOString().split('T')[0];
                    p.end = normalizedEnd.toISOString().split('T')[0];
                }
            });

            // Avanca data
            currentDate = nextDate;
            i = lookAhead;
        }

        return newPlans;
    };

    const triggerRecalculation = (currentPlans = operationPlans, customGroups = orderedGroups, dir = calcDirection, incST = includeST, incSat = includeSaturday) => {
        if (dir === 'backward') {
            setOperationPlans(calcRoutine({ isForward: false, anchorDate: targetEndDate, plansList: currentPlans, targetGroups: customGroups, joinedSet: joinedIndices, incST, incSat }));
        } else {
            setOperationPlans(calcRoutine({ isForward: true, anchorDate: targetStartDate, plansList: currentPlans, targetGroups: customGroups, joinedSet: joinedIndices, incST, incSat }));
        }
    };

    const saveCustomLayout = (layouts, dir) => {
        localStorage.setItem(PREF_KEY, JSON.stringify({
            layout: layouts.map(g => g.code),
            dir: dir
        }));
    };

    // 5. Interações do Usuário
    const moveGroup = (fromIndex, toIndex) => {
        const newGroups = [...orderedGroups];
        const [movedItem] = newGroups.splice(fromIndex, 1);
        newGroups.splice(toIndex, 0, movedItem);
        setOrderedGroups(newGroups);
        triggerRecalculation(operationPlans, newGroups, calcDirection);
    };

    // Drag and Drop (Nativo HTML5)
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Ghost trick for HTML5 DND (optional)
        e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnter = (e, index) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        moveGroup(draggedIndex, index);
        setDraggedIndex(index); // Update index to allow smooth continuous dragging
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        saveCustomLayout(orderedGroups, calcDirection); // Salva ao soltar
    };

    // Form Interactions
    const toggleJoin = (index) => {
        const newJoined = new Set(joinedIndices);
        if (newJoined.has(index)) newJoined.delete(index);
        else newJoined.add(index);
        setJoinedIndices(newJoined);
        setTimeout(() => triggerRecalculation(operationPlans, orderedGroups, calcDirection), 0);
    };

    const toggleDirection = () => {
        const newDir = calcDirection === 'backward' ? 'forward' : 'backward';
        setCalcDirection(newDir);
        saveCustomLayout(orderedGroups, newDir);
        triggerRecalculation(operationPlans, orderedGroups, newDir);
    };

    const toggleOperation = (code) => {
        const updated = { ...operationPlans, [code]: { ...operationPlans[code], selected: !operationPlans[code]?.selected } };
        triggerRecalculation(updated);
    };

    const toggleExpand = (code) => setExpandedOps(p => ({ ...p, [code]: !p[code] }));

    const toggleDaysMode = (mode) => {
        setDaysMode(mode);
        setTimeout(() => triggerRecalculation(), 0);
    };

    const updateOperationDuration = (code, value) => {
        const val = Math.max(0, parseInt(value) || 0);
        const updated = { ...operationPlans, [code]: { ...operationPlans[code], duracao: val } };
        triggerRecalculation(updated);
    };

    const adjustDuration = (code, delta) => {
        const currentDur = parseInt(operationPlans[code]?.duracao) || 0;
        updateOperationDuration(code, currentDur + delta);
    };

    // 6. Finalizar e Salvar Batch no Backend
    const handleSave = async () => {
        setLoading(true);
        try {
            const plansToSave = [];
            Object.entries(operationPlans).forEach(([code, plan]) => {
                if (plan.selected && plan.start && plan.end) {
                    const group = orderedGroups.find(g => g.code === code);
                    if (group) {
                        group.items.forEach(item => {
                            plansToSave.push({
                                op_numero: item.op,
                                op_item: item.item_op,
                                op_sequencia: item.sequen,
                                operacao_codigo: item.operacao,
                                data_inicio: plan.start.includes('T') ? plan.start : `${plan.start} 00:00:00`,
                                data_fim: plan.end.includes('T') ? plan.end : `${plan.end} 23:59:59`
                            });
                        });
                    }
                }
            });

            if (plansToSave.length === 0) {
                alert('Nenhuma operação selecionada com datas definidas.');
                setLoading(false); return;
            }

            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < plansToSave.length; i += CHUNK_SIZE) chunks.push(plansToSave.slice(i, i + CHUNK_SIZE));
            for (let i = 0; i < chunks.length; i++) await onSaveBatch(chunks[i]);

            alert(`✅ ${plansToSave.length} operações salvas com sucesso!`);
            onClose();
        } catch (error) {
            console.error('Erro:', error);
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DE DRAG AND DROP DO GANTT ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!draggingBar) return;
            const deltaX = e.clientX - draggingBar.startX;
            const offsetDays = Math.round(deltaX / 40); // 40px cell width
            setDraggingBar(prev => ({ ...prev, offsetDays }));
        };

        const handleMouseUp = () => {
            if (!draggingBar) return;
            
            if (draggingBar.offsetDays !== 0) {
                setOperationPlans(prev => {
                    const plan = prev[draggingBar.code];
                    if (!plan || !plan.start || !plan.end) return prev;
                    
                    const newStart = new Date(plan.start + 'T00:00:00');
                    newStart.setDate(newStart.getDate() + draggingBar.offsetDays);
                    
                    const newEnd = new Date(plan.end + 'T00:00:00');
                    newEnd.setDate(newEnd.getDate() + draggingBar.offsetDays);

                    return {
                        ...prev,
                        [draggingBar.code]: {
                            ...plan,
                            start: newStart.toISOString().split('T')[0],
                            end: newEnd.toISOString().split('T')[0]
                        }
                    };
                });
            }
            setDraggingBar(null);
        };

        if (draggingBar) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingBar]);

    const handleGanttBarMouseDown = (e, code) => {
        if (e.target.tagName.toLowerCase() === 'input') return; // ignora se for clique no input de duracao
        e.preventDefault();
        setDraggingBar({ code, startX: e.clientX, offsetDays: 0 });
    };

    // --- LÓGICA DO MODO GANTT ---
    const getGanttDates = () => {
        let minTime = Infinity;
        let maxTime = -Infinity;

        Object.values(operationPlans).forEach(p => {
            if (p.selected && p.start && p.end) {
                // Parse dates ensuring local timezone interpretation based on ISO strings
                const s = new Date(p.start + 'T00:00:00').getTime();
                const e = new Date(p.end + 'T00:00:00').getTime();
                if (s < minTime) minTime = s;
                if (e > maxTime) maxTime = e;
            }
        });

        if (minTime === Infinity || maxTime === -Infinity) {
             const now = new Date();
             now.setHours(0,0,0,0);
             minTime = now.getTime();
             maxTime = now.getTime() + (7 * 24 * 60 * 60 * 1000);
        }

        const minDate = new Date(minTime - (2 * 24 * 60 * 60 * 1000));
        const maxDate = new Date(maxTime + (2 * 24 * 60 * 60 * 1000));
        
        const diffDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 150) {
            maxDate.setTime(minDate.getTime() + (150 * 24 * 60 * 60 * 1000));
        }

        const dateArray = [];
        let cur = new Date(minDate);
        while (cur <= maxDate) {
            dateArray.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }

        return { minDate, maxDate, dateArray };
    };

    const renderGanttView = () => {
        const { minDate, dateArray } = getGanttDates();
        const CELL_WIDTH = 40;

        return (
            <div className="flex-1 overflow-auto bg-slate-50 relative flex flex-col border-y border-slate-200">
                <div className="flex relative w-max min-w-full">
                    {/* Header Columns Fixa e Scrollable */}
                    <div className="flex sticky top-0 bg-slate-100 z-30 border-b border-slate-200 shadow-sm">
                        {/* Resource Name Sticky Header */}
                        <div className="sticky left-0 bg-slate-100 w-[220px] min-w-[220px] border-r border-slate-200 p-2 flex items-center z-40">
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Recurso / Operação</span>
                        </div>
                        {/* Timeline Headers */}
                        <div className="flex">
                            {dateArray.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div key={i} className={`flex-shrink-0 w-[40px] text-center border-r border-slate-200 py-1 flex flex-col justify-center ${isWeekend ? 'bg-slate-200/50' : 'bg-white'}`}>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]}</span>
                                        <span className={`text-[10px] font-bold ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>{d.getDate().toString().padStart(2, '0')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden w-max min-w-full pb-8">
                    {orderedGroups.map((group) => {
                        const plan = operationPlans[group.code];
                        if (!plan || !plan.selected) return null;

                        const sDate = plan.start ? new Date(plan.start + 'T00:00:00') : null;
                        const eDate = plan.end ? new Date(plan.end + 'T00:00:00') : null;
                        

                        let baselineLeftPx = 0, baselineWidthPx = 0;
                        let hasDiff = false;
                        if (plan.baselineStart && plan.baselineEnd) {
                            const bsDate = new Date(plan.baselineStart + 'T00:00:00');
                            const beDate = new Date(plan.baselineEnd + 'T00:00:00');
                            const bStartDiff = Math.ceil((bsDate - minDate) / (1000 * 60 * 60 * 24));
                            const bEndDiff = Math.ceil((beDate - bsDate) / (1000 * 60 * 60 * 24)) + 1;
                            baselineLeftPx = bStartDiff * CELL_WIDTH;
                            baselineWidthPx = Math.max(bEndDiff * CELL_WIDTH, CELL_WIDTH);
                            if (plan.start !== plan.baselineStart || plan.end !== plan.baselineEnd) hasDiff = true;
                        }

                        return (
                            <div key={group.code} className="flex relative border-b border-slate-200 group/gantt hover:bg-blue-50/30">
                                {/* Sticky Label Left */}
                                <div className="sticky left-0 bg-white group-hover/gantt:bg-slate-50 w-[220px] min-w-[220px] border-r border-slate-200 p-2 flex items-center z-20 shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
                                    <div className="flex flex-col truncate">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-mono text-[9px] font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 truncate max-w-[80px]" title={group.code}>{group.code}</span>
                                            <span className="text-[10px] text-slate-800 font-medium truncate flex-1" title={group.desc}>{group.desc}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Gantt Track Area */}
                                <div className="relative flex" style={{ width: dateArray.length * CELL_WIDTH + 'px' }}>
                                    {/* Background Grid Lines */}
                                    <div className="absolute inset-0 flex pointer-events-none z-0">
                                        {dateArray.map((d, i) => (
                                            <div key={i} className={`flex-shrink-0 w-[40px] border-r border-slate-100 h-full ${(d.getDay() === 0 || d.getDay() === 6) ? 'bg-slate-100/40' : ''}`} />
                                        ))}
                                    </div>

                                    {/* Baseline Visualizer */}
                                    {plan.baselineStart && plan.baselineEnd && hasDiff && (
                                        <div 
                                           className="absolute top-[8px] h-[6px] bg-slate-300 rounded-sm opacity-60 z-10"
                                           style={{ left: `${baselineLeftPx}px`, width: `${baselineWidthPx}px` }}
                                           title={`Salvo: ${plan.baselineStart.split('-').reverse().join('/')}`}
                                        />
                                    )}

                                    {/* Barra segmentada: dias úteis = sólido, fins de semana = pontilhado */}
                                    {sDate && eDate && (() => {
                                        const isDraggingThis = draggingBar?.code === group.code;
                                        const ghostOffsetDays = isDraggingThis ? draggingBar.offsetDays : 0;

                                        // Gera um segmento por dia do intervalo
                                        const segments = [];
                                        const cur = new Date(sDate);
                                        cur.setHours(0, 0, 0, 0);
                                        const endD = new Date(eDate);
                                        endD.setHours(0, 0, 0, 0);

                                        while (cur <= endD) {
                                            const dow = cur.getDay();
                                            const isNonWorking = dow === 0 || (!includeSaturday && dow === 6);
                                            const daysFromMin = Math.round((cur.getTime() - minDate.getTime()) / 86400000);
                                            segments.push({
                                                leftPx: (daysFromMin + ghostOffsetDays) * CELL_WIDTH,
                                                isNonWorking,
                                            });
                                            cur.setDate(cur.getDate() + 1);
                                        }

                                        const solidCls = hasDiff
                                            ? 'bg-amber-400 border-amber-500'
                                            : 'bg-blue-500 border-blue-600';
                                        const dashCls = hasDiff
                                            ? 'border-amber-400 bg-amber-50/40'
                                            : 'border-blue-400 bg-blue-50/30';

                                        return (
                                            <div
                                                onMouseDown={(e) => handleGanttBarMouseDown(e, group.code)}
                                                className={`absolute inset-y-0 left-0 right-0 select-none ${isDraggingThis ? 'cursor-grabbing z-50' : 'cursor-grab z-10'}`}
                                            >
                                                {segments.map((seg, idx) => {
                                                    const isFirst = idx === 0;
                                                    const isLast = idx === segments.length - 1;
                                                    const roundL = isFirst ? 'rounded-l' : '';
                                                    const roundR = isLast ? 'rounded-r' : '';

                                                    if (seg.isNonWorking) {
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`absolute top-[16px] h-[16px] border-2 border-dashed ${dashCls} ${roundL} ${roundR}`}
                                                                style={{ left: `${seg.leftPx}px`, width: `${CELL_WIDTH}px` }}
                                                                title="Fim de semana — não contabilizado"
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`absolute top-[16px] h-[16px] border flex items-center justify-center shadow-sm ${solidCls} ${roundL} ${roundR} ${isDraggingThis ? 'opacity-90 ring-2 ring-blue-300' : ''}`}
                                                            style={{ left: `${seg.leftPx}px`, width: `${CELL_WIDTH}px` }}
                                                        >
                                                            {isFirst && (
                                                                <>
                                                                    <input
                                                                        type="number"
                                                                        value={plan.duracao}
                                                                        onChange={e => updateOperationDuration(group.code, e.target.value)}
                                                                        onMouseDown={(e) => e.stopPropagation()}
                                                                        className="w-5 shrink-0 bg-transparent text-center font-bold text-white text-[9px] outline-none appearance-none"
                                                                        style={{ MozAppearance: 'textfield' }}
                                                                    />
                                                                    {segments.length >= 2 && (
                                                                        <span className="text-[9px] font-bold text-white/80 pr-0.5 hidden sm:block">d</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-50 shadow-2xl w-[98vw] max-w-[1800px] h-[95vh] flex flex-col overflow-hidden border border-slate-300 rounded-lg">
                
                {/* Header Navbar */}
                <div className="px-3 py-2 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-normal">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Planejamento Sequencial 
                            <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-mono">OP {op.op}</span>
                        </h2>
                        
                        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                             <button onClick={() => setViewMode('list')} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Modo Lista</button>
                             <button onClick={() => setViewMode('gantt')} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'gantt' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Modo Gantt</button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Main Control Panel (Compact Layout) */}
                <div className="px-3 py-2 bg-white flex flex-wrap gap-3 items-center border-b border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] justify-between shrink-0">
                    
                    {/* Anchor Date Setup & Mode Toggle */}
                    <div className="flex gap-2 items-center flex-1">
                        {/* Direction Toggle */}
                        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200" title="Direção do sequenciamento">
                            <button
                                onClick={toggleDirection}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                    calcDirection === 'forward' ? 'bg-white text-green-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <MoveDown className={`w-3 h-3 ${calcDirection === 'forward' ? 'text-green-500' : ''}`} /> Progressivo
                            </button>
                            <button
                                onClick={toggleDirection}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                    calcDirection === 'backward' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <MoveUp className={`w-3 h-3 ${calcDirection === 'backward' ? 'text-blue-500' : ''}`} /> Regressivo
                            </button>
                        </div>
                        
                        {/* Date Inputs based on direction */}
                        {calcDirection === 'backward' ? (
                            <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 fade-in">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Data Final (Entrega):</label>
                                <input 
                                    type="date" 
                                    value={targetEndDate} onChange={e => { setTargetEndDate(e.target.value); setTimeout(()=> triggerRecalculation(), 0); }}
                                    className="border border-blue-200 bg-blue-50 text-blue-900 text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold" 
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2 fade-in">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Data Inicial (Fabricar):</label>
                                <input 
                                    type="date" 
                                    value={targetStartDate} onChange={e => { setTargetStartDate(e.target.value); setTimeout(()=> triggerRecalculation(), 0); }}
                                    className="border border-green-200 bg-green-50 text-green-900 text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-green-500 font-bold" 
                                />
                            </div>
                        )}
                    </div>

                    {/* Work Days Config */}
                    <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded border border-slate-200">
                        <button
                            onClick={() => toggleDaysMode('calendar')}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${daysMode === 'calendar' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Globe className="w-3 h-3" /> Corridos
                        </button>
                        <button
                            onClick={() => toggleDaysMode('business')}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${daysMode === 'business' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Briefcase className="w-3 h-3" /> Úteis
                        </button>
                        {daysMode === 'business' && (
                            <label className="flex items-center gap-1 cursor-pointer text-[9px] font-bold text-slate-600 uppercase tracking-tight select-none hover:text-blue-600 transition-colors ml-1 pr-1 border-l border-slate-200 pl-1">
                                <input 
                                    type="checkbox" 
                                    checked={includeSaturday} 
                                    onChange={(e) => {
                                        setIncludeSaturday(e.target.checked);
                                        setTimeout(() => triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, e.target.checked), 0);
                                    }}
                                    className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                Incluir Sábado?
                            </label>
                        )}
                    </div>

                    {/* ST Services Toggle */}
                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 uppercase tracking-tight select-none hover:text-blue-600 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={includeST} 
                                onChange={(e) => {
                                    setIncludeST(e.target.checked);
                                    setTimeout(() => triggerRecalculation(operationPlans, orderedGroups, calcDirection, e.target.checked), 0);
                                }}
                                className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            Incluir "ST" no cálculo?
                        </label>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    <>
                        {/* Headers Table */}
                        <div className="px-3 py-1 bg-slate-100 border-b border-slate-200 flex text-[9px] font-bold uppercase text-slate-500 tracking-wider items-center shrink-0">
                            <div className="w-6"></div> {/* Grip */}
                            <div className="w-5"></div> {/* Check */}
                            <div className="flex-1 min-w-[140px] px-2">Recurso / Operação</div>
                            <div className="w-20 text-center">Duração</div>
                            <div className="w-[140px] text-center">Início <span className="text-slate-300">|</span> Fim</div>
                            <div className="w-6"></div> {/* Exapand */}
                        </div>

                        {/* Operations List Grouped by Resource (Scrollable) */}
                        <div className="flex-1 overflow-y-auto px-2 py-2 bg-slate-50 relative">
                            
                            {/* Linha Vermelha de progressao visual baseada na direcao */}
                            <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 to-indigo-200 z-0"></div>

                            {orderedGroups.map((group, index) => {
                                const plan = operationPlans[group.code] || { start: '', end: '', selected: false, baselineStart: '', baselineEnd: '' };
                                const isExpanded = expandedOps[group.code];
                                const isJoined = joinedIndices.has(index);
                                const isNextJoined = index + 1 < orderedGroups.length && joinedIndices.has(index + 1);
                                const isBeingDragged = draggedIndex === index;

                                return (
                                    <React.Fragment key={group.code}>
                                        {index > 0 && (
                                            <div className="relative h-2 flex items-center z-20 -my-1 -ml-1">
                                                <button onClick={() => toggleJoin(index)}
                                                    className={`absolute left-[40px] p-[2px] transition-all
                                                    ${isJoined ? 'text-blue-500 bg-white border border-blue-200 rounded' 
                                                    : 'text-slate-300 hover:text-blue-400 opacity-50 hover:opacity-100'}`}
                                                    title="Unir Fluxo de Tempo"
                                                >
                                                    <Link className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        <div
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnter={(e) => handleDragEnter(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => e.preventDefault()}
                                            className={`relative z-10 mx-1 ml-4 transition-all duration-150 flex items-stretch bg-white border cursor-default group/row
                                                ${isBeingDragged ? 'opacity-80 shadow-xl border-blue-400 scale-[0.99] rotate-0 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}
                                                ${isJoined ? 'border-t-slate-100 rounded-t-sm mt-0' : 'rounded-t mt-1'} 
                                                ${isNextJoined ? 'border-b-transparent rounded-b-sm' : 'rounded-b shadow-[0_1px_2px_rgba(0,0,0,0.02)]'} 
                                                ${!plan.selected ? 'opacity-50 grayscale-[0.5]' : ''} 
                                            `}
                                        >
                                            {isJoined && <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-500 z-10 rounded-l" />}

                                            {/* Drag Handle */}
                                            <div className="w-6 flex items-center justify-center bg-slate-50/80 border-r border-slate-100 cursor-grab active:cursor-grabbing hover:bg-slate-200/50 rounded-l">
                                                <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                                            </div>

                                            {/* Checkbox */}
                                            <div onClick={() => toggleOperation(group.code)} className="w-6 flex items-center justify-center border-r border-slate-50 cursor-pointer hover:bg-slate-50">
                                                {plan.selected ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                                            </div>

                                            {/* Info Panel */}
                                            <div className="flex-1 px-2 py-1 flex items-center gap-2 overflow-hidden min-w-[140px]">
                                                <div className="flex flex-col truncate">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 leading-none" title={group.code}>
                                                            {group.code}
                                                        </span>
                                                        <span className="text-[11px] text-slate-800 font-medium truncate" title={group.desc}>
                                                            {group.desc}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* MS Project Baseline Visualizer */}
                                                    {plan.baselineStart && plan.baselineEnd && (
                                                      <div className="mt-1 w-full bg-slate-50 border border-slate-100 rounded-sm h-[5px] flex items-center relative overflow-hidden shrink-0 group relative">
                                                        <div className="absolute opacity-0 group-hover:opacity-100 top-[-20px] left-0 bg-slate-800 text-white text-[8px] px-1 py-0.5 rounded z-50 pointer-events-none whitespace-nowrap">
                                                            Salvo: {plan.baselineStart.split('-').reverse().join('/')}
                                                        </div>
                                                        {/* Comparativo de Offset: Simulamos um Range */}
                                                        {(plan.start !== plan.baselineStart || plan.end !== plan.baselineEnd) ? (
                                                            <>
                                                                <div className="absolute left-[5%] w-[90%] bg-slate-200 h-full"></div>
                                                                <div className={`absolute h-full opacity-70 transition-all ${plan.start > plan.baselineStart ? 'bg-amber-400 w-[60%] left-[35%]' : plan.start < plan.baselineStart ? 'bg-green-500 w-[60%] left-0' : 'bg-blue-400 w-[90%] left-[5%]'}`}></div>
                                                            </>
                                                        ) : (
                                                            <div className="absolute left-[5%] w-[90%] bg-slate-300 h-full"></div>
                                                        )}
                                                      </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Duration Counter */}
                                            <div className="w-20 px-1 py-1 flex items-center justify-center border-l border-slate-50 bg-slate-50/50">
                                                <button onClick={() => adjustDuration(group.code, -1)} disabled={!plan.selected} className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-0 rounded bg-white border border-slate-100 shadow-sm"><Minus className="w-2.5 h-2.5" /></button>
                                                <input type="text" value={plan.duracao} onChange={e => updateOperationDuration(group.code, e.target.value)} disabled={!plan.selected}
                                                    className="w-6 mx-0.5 bg-transparent text-center text-[11px] font-bold text-slate-700 outline-none" />
                                                <button onClick={() => adjustDuration(group.code, 1)} disabled={!plan.selected} className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-0 rounded bg-white border border-slate-100 shadow-sm"><Plus className="w-2.5 h-2.5" /></button>
                                            </div>

                                            {/* Calculated Dates Inputs */}
                                            <div className="w-[140px] px-1 py-1 flex items-center justify-center gap-1 border-l border-slate-50">
                                                <input type="date" value={plan.start ? plan.start.split('T')[0] : ''} onChange={e => { setOperationPlans(p => ({...p, [group.code]: {...p[group.code], start: e.target.value}})); }} disabled={!plan.selected}
                                                    className={`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center ${plan.start !== plan.baselineStart ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`} />
                                                <span className="text-slate-300 text-[10px]">&gt;</span>
                                                <input type="date" value={plan.end ? plan.end.split('T')[0] : ''} onChange={e => { setOperationPlans(p => ({...p, [group.code]: {...p[group.code], end: e.target.value}})); }} disabled={!plan.selected}
                                                    className={`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center ${plan.end !== plan.baselineEnd ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`} />
                                            </div>

                                            {/* Expand Button */}
                                            <div className="w-6 flex items-center justify-center border-l border-slate-50 bg-white rounded-r">
                                                <button onClick={() => toggleExpand(group.code)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded">
                                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>

                                        </div>

                                        {/* Expanded Group View */}
                                        {isExpanded && (
                                            <div className="mx-1 ml-4 border-l border-r border-b border-blue-200 bg-blue-50/50 p-1.5 rounded-b mb-1 relative -top-1 opacity-90">
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {group.items.map((item, idx) => (
                                                        <div key={idx} className="bg-white border border-blue-100 px-1.5 py-0.5 rounded text-[8px] text-blue-900 flex items-center gap-1 shadow-sm font-medium">
                                                            <span>OP {item.operacao}</span>
                                                            <span className="text-blue-400">({item.item_op}/{item.sequen})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    renderGanttView()
                )}

                {/* Footer NavBar */}
                <div className="px-3 py-2 bg-slate-800 flex justify-between items-center rounded-b-lg shrink-0">
                    <div className="text-[9px] text-slate-400 font-medium tracking-wide flex items-center gap-2">
                        <GripVertical className="w-3 h-3 text-slate-500" />
                        <span>Arraste as operações para reordenar o fluxo</span>
                        <span className="opacity-50">| Mudanças são auto-salvas localmente</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold text-white transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={loading} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold text-white flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-900/50 disabled:opacity-50 border border-blue-500">
                            {loading ? 'Salvando...' : <><Save className="w-3.5 h-3.5" /> Salvar Configuração</>}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}