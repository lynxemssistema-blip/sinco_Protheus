import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, GripVertical, MoveUp, MoveDown, Briefcase, Globe, Plus, Minus, Link, Printer, History, Clock, RotateCcw, AlertTriangle, CheckCircle, MessageSquare, ChevronLeft, HelpCircle, BookOpen, MousePointer, ArrowRight, Zap, Lock, RefreshCcw } from 'lucide-react';
import { useHelp } from '../contexts/HelpContext';
import { generateGanttPDF } from '../services/ganttPdfGenerator';

export default function ProductionMacroModal({ op, operations, onClose, onSaveBatch }) {

    const [operationPlans, setOperationPlans] = useState({}); 
    const [expandedOps, setExpandedOps] = useState({});
    const [loading, setLoading] = useState(false);
    
    // Referência para o container visual do Gantt
    const ganttContainerRef = useRef(null);
    
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
    const [includeSunday, setIncludeSunday] = useState(false); // Consider Sunday as workday
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'gantt'

    // Controle do Dialog de Confirmação de Salvamento
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveObservacao, setSaveObservacao] = useState('');

    // Painel lateral de Histórico de Versões
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedLote, setExpandedLote] = useState(null);

    // Rastreamento de alterações não salvas
    const [savedSnapshot, setSavedSnapshot] = useState(null); // snapshot do último estado salvo
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [draggingBar, setDraggingBar] = useState(null);
    const [showHelp, setShowHelp] = useState(false); // painel de ajuda contextual

    // Estrutura
    const [orderedGroups, setOrderedGroups] = useState([]);
    // BUG FIX #2: Armazena codes (strings) em vez de índices numéricos
    // Índices mudam ao reordenar; codes são estáveis e identificam unicamente a operação
    const [joinedCodes, setJoinedCodes] = useState(new Set());
    const [draggedIndex, setDraggedIndex] = useState(null);
    // BUG FIX #1: Estado temporário de pré-visualização de ordem durante o arrastar
    // Evita que moveGroup chame triggerRecalculation dezenas de vezes/seg
    const [previewGroups, setPreviewGroups] = useState(null);

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

    // 2. Inicialização do Estado � Lê Baseline do Banco e carrega preferências do servidor
    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const initialPlans = {};
            const initialExpanded = {};
            let initialEndDate = '';
            let initialStartDate = '';
            let groupsToUse = [...groupedByRecurso];
            let savedDirection = 'backward';

            // ���� Carrega preferências do SERVIDOR (compartilhado entre usuários) ����
            try {
                const [prefsRes, recursosRes] = await Promise.all([
                    fetch(`/api/production/planning-prefs/${encodeURIComponent(op.op)}`),
                    fetch('/api/pcp-refinado/recursos')
                ]);

                if (recursosRes.ok && isMounted) {
                    const recData = await recursosRes.json();
                    const recMap = {};
                    recData.forEach(r => {
                        recMap[r.cod_recurso] = r.ordem_exibicao || 0;
                    });
                    
                    groupsToUse.forEach(g => {
                        g.ordem_exibicao = recMap[g.code] || 0;
                    });
                    
                    groupsToUse.sort((a, b) => {
                        if (a.ordem_exibicao !== b.ordem_exibicao) {
                            return a.ordem_exibicao - b.ordem_exibicao;
                        }
                        return a.min_sequen - b.min_sequen;
                    });
                }

                if (prefsRes.ok) {
                    const prefs = await prefsRes.json();
                    if (prefs && isMounted) {
                        if (prefs.diasModo)                         setDaysMode(prefs.diasModo);
                        if (typeof prefs.incluiSabado === 'boolean') setIncludeSaturday(prefs.incluiSabado);
                        if (typeof prefs.incluiDomingo === 'boolean') setIncludeSunday(prefs.incluiDomingo);
                        if (typeof prefs.incluiST === 'boolean')     setIncludeST(prefs.incluiST);

                        // Restaura ordem das operações salva no banco
                        if (prefs.ordemRecursos && Array.isArray(prefs.ordemRecursos)) {
                            const validCodes = new Set(groupsToUse.map(g => g.code));
                            const filtered = prefs.ordemRecursos.filter(c => validCodes.has(c));
                            const sorted = [];
                            filtered.forEach(code => {
                                const idx = groupsToUse.findIndex(g => g.code === code);
                                if (idx >= 0) sorted.push(groupsToUse.splice(idx, 1)[0]);
                            });
                            groupsToUse = [...sorted, ...groupsToUse];
                        }
                    }
                }
            } catch (e) {
                console.warn('[PREFS] Erro ao carregar preferências do servidor:', e);
            }

            // ���� Fallback: tenta localStorage apenas para direção (dir) ����
            try {
                const saved = localStorage.getItem(PREF_KEY);
                if (saved) {
                    const local = JSON.parse(saved);
                    if (local.dir) savedDirection = local.dir;
                }
            } catch (e) { /* ignora */ }

            // ���� Monta os planos iniciais com base nas datas já salvas ����
            groupsToUse.forEach(group => {
                let existingStart = '';
                let existingEnd = '';
                let dur = 0;

                const plannedItem = group.items.find(i => i.data_planejada_inicio && i.data_planejada_fim);
                if (plannedItem) {
                    const parseSafeDate = (val) => {
                        const str = String(val);
                        return str.substring(0, 10);
                    };

                    existingStart = parseSafeDate(plannedItem.data_planejada_inicio);
                    existingEnd   = parseSafeDate(plannedItem.data_planejada_fim);
                    const s = new Date(existingStart + 'T12:00:00');
                    const e = new Date(existingEnd   + 'T12:00:00');
                    dur = Math.max(1, countBusinessDays(s, e, false));

                    if (!initialEndDate || existingEnd > initialEndDate) initialEndDate = existingEnd;
                    if (!initialStartDate || existingStart < initialStartDate) initialStartDate = existingStart;
                }

                initialPlans[group.code] = {
                    start: existingStart,
                    end: existingEnd,
                    baselineStart: existingStart,
                    baselineEnd: existingEnd,
                    duracao: dur,
                    selected: true,
                    locked: group.items.some(i => Number(i.qtd_produzida_real) >= Number(i.qtd_planejada_op)),
                    isAlreadyPlanned: existingStart !== '',
                    manuallySet: existingStart !== '',
                };
                initialExpanded[group.code] = false;
            });

            if (!isMounted) return;
            setOperationPlans(initialPlans);
            setExpandedOps(initialExpanded);
            setOrderedGroups(groupsToUse);
            setCalcDirection(savedDirection);
            if (initialEndDate) setTargetEndDate(initialEndDate);
            if (initialStartDate) setTargetStartDate(initialStartDate);
        };

        initialize();
        return () => { isMounted = false; };
    }, [groupedByRecurso, PREF_KEY]);


    // 3. Utilitários de Data
    const subtractDays = (date, days, mode, incSat = false, incSun = false) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() - 1);
            if (mode === 'business') {
                const day = result.getDay();
                if ((day !== 0 || incSun) && (day !== 6 || incSat)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    const addDays = (date, days, mode, incSat = false, incSun = false) => {
        const result = new Date(date);
        let count = 0;
        while (count < days) {
            result.setDate(result.getDate() + 1);
            if (mode === 'business') {
                const day = result.getDay();
                if ((day !== 0 || incSun) && (day !== 6 || incSat)) count++;
            } else {
                count++;
            }
        }
        return result;
    };

    // Converte string ou Date em um objeto Date normalizado (meio-dia para evitar DST)
    const safeDate = (dateVal) => {
        if (!dateVal) return new Date();
        if (dateVal instanceof Date) return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate(), 12, 0, 0);
        const str = String(dateVal);
        const ymd = str.split('T')[0];
        if (ymd.length === 10) return new Date(ymd + 'T12:00:00');
        return new Date(dateVal);
    };

    // Normaliza uma data para o dia útil mais próximo (evita domingo/sábado como âncora)
    const skipToWorkday = (date, forward, incSat, incSun) => {
        const result = new Date(date);
        while (true) {
            const day = result.getDay();
            if (!incSun && day === 0) { // Domingo
                result.setDate(result.getDate() + (forward ? 1 : -1));
            } else if (!incSat && day === 6) { // Sábado
                result.setDate(result.getDate() + (forward ? 1 : -1));
            } else {
                break;
            }
        }
        return result;
    };

    // Conta dias úteis entre duas datas (inclusivo)
    const countBusinessDays = (startDate, endDate, incSat, incSun) => {
        let count = 0;
        const cur = new Date(startDate);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
            const day = cur.getDay();
            if ((day !== 0 || incSun) && (day !== 6 || incSat)) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    };

    // 4. Lógicas de Cálculo Sequencial
    const calcRoutine = (params) => {
        const { isForward, anchorDate, plansList, targetGroups, joinedSet, incST, incSat, incSun, overrideDaysMode } = params;
        const dMode = overrideDaysMode || daysMode;
        if (!anchorDate) return plansList;

        const newPlans = { ...plansList };

        // Se forward: processa do index [0 -> N]
        // Se backward: processa do index [N -> 0]
        const indices = isForward
            ? [...Array(targetGroups.length).keys()]
            : [...Array(targetGroups.length).keys()].reverse();

        // Normaliza a data âncora � impede que domingo/sábado seja início/fim de operação
        let currentDate = dMode === 'business'
            ? skipToWorkday(safeDate(anchorDate), isForward, incSat, incSun)
            : safeDate(anchorDate);
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
                    eDate = addDays(blockAnchorDate, maxDur - 1, dMode, incSat, incSun);
                    nextDate = addDays(blockAnchorDate, maxDur, dMode, incSat, incSun);
                }
            } else {
                eDate = blockAnchorDate;
                if (maxDur === 0) {
                    sDate = blockAnchorDate;
                    nextDate = blockAnchorDate;
                } else {
                    sDate = subtractDays(blockAnchorDate, maxDur - 1, dMode, incSat, incSun);
                    nextDate = subtractDays(blockAnchorDate, maxDur, dMode, incSat, incSun);
                }
            }

            blockIndices.forEach(bIdx => {
                const g = targetGroups[bIdx];
                const p = newPlans[g.code];
                if (p && p.selected) {
                    if (p.locked) {
                        // Bloqueado: não altera datas
                    } else if (p.manuallySet) {
                        // Ajustado manualmente: atualiza a outra ponta para acompanhar a duração
                        if (isForward && p.start) {
                            const baseStart = safeDate(p.start);
                            const newEnd = p.duracao > 0 ? addDays(baseStart, p.duracao - 1, dMode, incSat, incSun) : baseStart;
                            const normalizedEnd = dMode === 'business' ? skipToWorkday(newEnd, true, incSat, incSun) : newEnd;
                            p.end = normalizedEnd.toISOString().split('T')[0];
                        } else if (!isForward && p.end) {
                            const baseEnd = safeDate(p.end);
                            const newStart = p.duracao > 0 ? subtractDays(baseEnd, p.duracao - 1, dMode, incSat, incSun) : baseEnd;
                            const normalizedStart = dMode === 'business' ? skipToWorkday(newStart, false, incSat, incSun) : newStart;
                            p.start = normalizedStart.toISOString().split('T')[0];
                        }
                    } else {
                        // Cascata normal
                        const normalizedEnd = dMode === 'business'
                            ? skipToWorkday(new Date(eDate), true, incSat, incSun)
                            : eDate;
                        p.start = sDate.toISOString().split('T')[0];
                        p.end = normalizedEnd.toISOString().split('T')[0];
                    }
                }
            });

            // Avanca data
            currentDate = nextDate;
            i = lookAhead;
        }

        return newPlans;
    };

    // FIX #4: Aceita overrideEndDate/overrideStartDate para evitar leitura de closure stale
    // quando chamado diretamente de onChange (React state ainda não atualizou)
    const triggerRecalculation = (
        currentPlans = operationPlans,
        customGroups = orderedGroups,
        dir = calcDirection,
        incST = includeST,
        incSat = includeSaturday,
        incSun = includeSunday,
        currentJoinedCodes = joinedCodes,
        overrideEndDate,
        overrideStartDate,
        overrideDaysMode
    ) => {
        const joinedSet = new Set();
        customGroups.forEach((g, idx) => {
            if (idx > 0 && currentJoinedCodes.has(customGroups[idx - 1].code)) {
                joinedSet.add(idx - 1);
            }
        });

        const actualMode = overrideDaysMode || daysMode;

        if (dir === 'backward') {
            setOperationPlans(calcRoutine({
                isForward: false,
                anchorDate: overrideEndDate ?? targetEndDate,
                plansList: currentPlans, targetGroups: customGroups, joinedSet, incST, incSat, incSun, overrideDaysMode: actualMode
            }));
        } else {
            setOperationPlans(calcRoutine({
                isForward: true,
                anchorDate: overrideStartDate ?? targetStartDate,
                plansList: currentPlans, targetGroups: customGroups, joinedSet, incST, incSat, incSun, overrideDaysMode: actualMode
            }));
        }
    };

    // FIX PREFS: Persiste TODAS as preferências do usuário no localStorage
    const saveCustomLayout = (layouts, dir, opts = {}) => {
        localStorage.setItem(PREF_KEY, JSON.stringify({
            layout: layouts.map(g => g.code),
            dir: dir,
            daysMode:        opts.daysMode        ?? daysMode,
            includeST:       opts.includeST       ?? includeST,
            includeSaturday: opts.includeSaturday ?? includeSaturday,
            includeSunday:   opts.includeSunday   ?? includeSunday,
        }));
    };

    // 5. Interações do Usuário

    // BUG FIX #1: moveGroup agora APENAS reordena visualmente (sem recalcular)
    // O recálculo é feito SOMENTE no handleDragEnd para evitar re-renders em cascata
    const moveGroup = (fromIndex, toIndex) => {
        const source = previewGroups || orderedGroups;
        const newGroups = [...source];
        const [movedItem] = newGroups.splice(fromIndex, 1);
        newGroups.splice(toIndex, 0, movedItem);
        setPreviewGroups(newGroups); // Atualiza apenas pré-visualização
    };

    // Drag and Drop (Nativo HTML5)
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        setPreviewGroups([...orderedGroups]); // Inicializa preview com estado atual
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnter = (e, index) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        // BUG FIX #1: Apenas reordena visualmente � SEM recálculo aqui
        moveGroup(draggedIndex, index);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        // BUG FIX #1: Recálculo acontece UMA �aNICA VEZ ao soltar
        const finalGroups = previewGroups || orderedGroups;
        setOrderedGroups(finalGroups);
        setPreviewGroups(null);
        setDraggedIndex(null);
        triggerRecalculation(operationPlans, finalGroups, calcDirection);
        saveCustomLayout(finalGroups, calcDirection);
    };

    // Form Interactions
    // BUG FIX #2: toggleJoin agora usa o code da operação ANTERIOR como chave do vínculo
    // Ex: unir op no índice 2 com op no índice 1 = armazenar code da op[1] no Set
    // Isso é estável mesmo após reordenação
    const toggleJoin = (index) => {
        if (index === 0) return; // Primeira op não pode ser unida a nada anterior
        const prevCode = orderedGroups[index - 1]?.code;
        if (!prevCode) return;
        const newJoined = new Set(joinedCodes);
        if (newJoined.has(prevCode)) newJoined.delete(prevCode);
        else newJoined.add(prevCode);
        setJoinedCodes(newJoined);
        // BUG FIX #3: Sem setTimeout � passa parâmetros explicitamente
        triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, includeSaturday, includeSunday, newJoined);
    };

    const toggleDirection = () => {
        const newDir = calcDirection === 'backward' ? 'forward' : 'backward';
        setCalcDirection(newDir);
        saveCustomLayout(orderedGroups, newDir);
        // BUG FIX #3: Passa newDir explicitamente � sem setTimeout
        triggerRecalculation(operationPlans, orderedGroups, newDir, includeST, includeSaturday, includeSunday, joinedCodes);
    };

    const toggleOperation = (code) => {
        const updated = { ...operationPlans, [code]: { ...operationPlans[code], selected: !operationPlans[code]?.selected } };
        triggerRecalculation(updated, orderedGroups, calcDirection, includeST, includeSaturday, includeSunday, joinedCodes);
    };

    const toggleExpand = (code) => setExpandedOps(p => ({ ...p, [code]: !p[code] }));

    const toggleDaysMode = (mode) => {
        setDaysMode(mode);
        saveCustomLayout(orderedGroups, calcDirection, { daysMode: mode });
        triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, includeSaturday, includeSunday, joinedCodes, undefined, undefined, mode);
    };

    // FIX REPLAN: Ao mudar a data âncora, DESLOCA todas as ops proporcionalmente
    // em vez de fazer tight-packing (cascata que destrói gaps existentes).
    const handleAnchorDateChange = (type, newVal) => {
        if (!newVal) return;
        const oldVal = type === 'end' ? targetEndDate : targetStartDate;
        let updatedPlans = operationPlans;

        if (oldVal && newVal && oldVal !== newVal) {
            const diffMs = new Date(newVal + 'T12:00:00') - new Date(oldVal + 'T12:00:00');
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays !== 0) {
                const shifted = {};
                Object.entries(operationPlans).forEach(([code, p]) => {
                    if (p.selected && p.start && p.end) {
                        const s = new Date(p.start + 'T12:00:00');
                        s.setDate(s.getDate() + diffDays);
                        const e = new Date(p.end + 'T12:00:00');
                        e.setDate(e.getDate() + diffDays);
                        shifted[code] = { ...p, start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] };
                    } else {
                        shifted[code] = { ...p };
                    }
                });
                updatedPlans = shifted;
                setOperationPlans(shifted);
            }
        }

        if (type === 'end') setTargetEndDate(newVal);
        else setTargetStartDate(newVal);
    };

    // FIX REPLAN: Compactação intencional � remove manuallySet e faz cascata limpa.
    // O usuário aciona isso explicitamente quando QUER a cascata.
    const handleRepackCascade = () => {
        if (!confirm('Isso irá compactar todas as operações em cascata a partir da data alvo, removendo espaços entre elas.\n\nConfirmar?')) return;
        const updated = {};
        Object.entries(operationPlans).forEach(([code, p]) => {
            updated[code] = { ...p, manuallySet: false };
        });
        triggerRecalculation(updated, orderedGroups, calcDirection, includeST, includeSaturday, includeSunday, joinedCodes);
    };

    const updateOperationDuration = (code, value) => {
        let val = value;
        if (value !== '') {
            val = Math.max(0, parseInt(value) || 0);
        }
        const updated = { ...operationPlans, [code]: { ...operationPlans[code], duracao: val } };
        // BUG FIX #3: Passa joinedCodes explicitamente
        triggerRecalculation(updated, orderedGroups, calcDirection, includeST, includeSaturday, includeSunday, joinedCodes);
    };

    const adjustDuration = (code, delta) => {
        const currentDur = parseInt(operationPlans[code]?.duracao) || 0;
        updateOperationDuration(code, currentDur + delta);
    };

    // Calcula snapshot simples para detectar alterações não salvas
    const buildSnapshot = useCallback(() => {
        return JSON.stringify(
            Object.entries(operationPlans)
                .filter(([, p]) => p.selected)
                .map(([code, p]) => ({ code, s: p.start, e: p.end, d: p.duracao }))
                .sort((a, b) => a.code.localeCompare(b.code))
        );
    }, [operationPlans]);

    const hasUnsavedChanges = savedSnapshot !== null && buildSnapshot() !== savedSnapshot;

    // Abre o dialog de confirmação antes de salvar
    const handleSave = () => {
        const anySelected = Object.values(operationPlans).some(p => p.selected && p.start && p.end);
        if (!anySelected) {
            alert('Nenhuma operação válida selecionada com datas definidas.');
            return;
        }
        setSaveObservacao('');
        setShowSaveDialog(true);
    };

    // Salva de fato após confirmação no dialog
    const handleConfirmSave = async () => {
        setShowSaveDialog(false);
        setLoading(true);
        try {
            const plansToSave = [];
            Object.entries(operationPlans).forEach(([code, plan]) => {
                if (plan.selected && plan.start && plan.end) {
                    const group = orderedGroups.find(g => g.code === code);
                    if (group) {
                        group.items.forEach(item => {
                            if (!item.operacao) return;
                            plansToSave.push({
                                op_numero: item.op,
                                op_item: item.item_op,
                                op_sequencia: item.sequen,
                                operacao_codigo: item.operacao,
                                data_inicio: plan.start.includes('T') ? plan.start : `${plan.start} 00:00:00`,
                                data_fim: plan.end.includes('T') ? plan.end : `${plan.end} 23:59:59`,
                                duracao_dias: plan.duracao || null,
                                recurso_code: code,
                                recurso_desc: group.desc || null
                            });
                        });
                    }
                }
            });

            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < plansToSave.length; i += CHUNK_SIZE) chunks.push(plansToSave.slice(i, i + CHUNK_SIZE));

            // Envia preferências apenas no primeiro chunk (associadas ao lote criado no backend)
            const preferencias = {
                diasModo:      daysMode,
                incluiSabado:  includeSaturday,
                incluiDomingo: includeSunday,
                incluiST:      includeST,
                ordemRecursos: orderedGroups.map(g => g.code)
            };
            for (let i = 0; i < chunks.length; i++) {
                await onSaveBatch(chunks[i], saveObservacao, calcDirection, preferencias);
            }

            const now = new Date();
            setLastSavedAt(now);
            setSavedSnapshot(buildSnapshot());
            alert(`�S& ${plansToSave.length} operações salvas com sucesso!`);
            onClose(true);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Carrega histórico de versões da OP
    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/production/planning-history/${op.op}`);
            if (!res.ok) throw new Error('Erro ao buscar histórico');
            const data = await res.json();
            setHistoryData(data);
        } catch (e) {
            console.error('[HISTORY]', e);
            setHistoryData([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Restaura um lote do histórico como plano atual
    const handleRestoreLote = (lote) => {
        if (!confirm(`Restaurar o planejamento do lote ${lote.lote_id}?\nIsso substituirá o plano atual (não salvo ainda).`)) return;
        const restored = { ...operationPlans };
        lote.operacoes.forEach(op => {
            const code = op.recurso_code || op.operacao_codigo;
            if (restored[code]) {
                restored[code] = {
                    ...restored[code],
                    start: op.data_inicio?.split('T')[0] || op.data_inicio?.split(' ')[0],
                    end: op.data_fim?.split('T')[0] || op.data_fim?.split(' ')[0],
                    duracao: op.duracao_dias || restored[code].duracao,
                    selected: true
                };
            }
        });
        setOperationPlans(restored);
        setShowHistory(false);
    };

    const handlePrint = () => {
        generateGanttPDF(op, orderedGroups, operationPlans);
    };

    // Atalho Ctrl+S para salvar
    useEffect(() => {
        const onKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [operationPlans, calcDirection]); // eslint-disable-line

    // Calcula indicador de folga até data de entrega
    const deliverySlack = useMemo(() => {
        const deliveryDate = op?.data_entrega || op?.dataEntrega || op?.c6_entreg;
        if (!deliveryDate || !targetEndDate) return null;
        // Normaliza data de entrega (formato YYYYMMDD do Protheus ou ISO)
        let d;
        if (typeof deliveryDate === 'string' && deliveryDate.length === 8 && !deliveryDate.includes('-')) {
            d = new Date(`${deliveryDate.slice(0,4)}-${deliveryDate.slice(4,6)}-${deliveryDate.slice(6,8)}`);
        } else {
            d = new Date(deliveryDate);
        }
        const planned = new Date(targetEndDate);
        if (isNaN(d) || isNaN(planned)) return null;
        const diffMs = d - planned;
        const diffDays = Math.round(diffMs / 86400000);
        return diffDays;
    }, [op, targetEndDate]);

    // Percentual de operações planejadas (selecionadas com datas)
    const planProgress = useMemo(() => {
        const total = orderedGroups.length;
        if (total === 0) return { done: 0, total: 0, pct: 0 };
        const done = orderedGroups.filter(g => {
            const p = operationPlans[g.code];
            return p?.selected && p?.start && p?.end;
        }).length;
        return { done, total, pct: Math.round((done / total) * 100) };
    }, [orderedGroups, operationPlans]);

    // --- L�GICA DE DRAG AND DROP DO GANTT ---
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
                            end: newEnd.toISOString().split('T')[0],
                            // BUG FIX #4: Marca como ajuste manual para proteger de recálculos automáticos
                            manuallySet: true
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
        if (operationPlans[code]?.locked) return; // Não permite arrastar operações concluídas
        e.preventDefault();
        setDraggingBar({ code, startX: e.clientX, offsetDays: 0 });
    };

    // --- L�GICA DO MODO GANTT ---
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
        // Dimensões da linha e barra � centralizadas verticalmente
        const ROW_H    = 56;  // altura total da linha (px)
        const BAR_H    = 28;  // altura da barra (px)
        const BAR_TOP  = (ROW_H - BAR_H) / 2; // offset topo para centralizar: 10px

        return (
            <div className="flex-1 overflow-auto bg-slate-50 relative flex flex-col border-y border-slate-200">
                <div ref={ganttContainerRef} className="flex flex-col w-max min-w-full bg-slate-50">
                    <div className="flex relative w-max min-w-full">
                        {/* Header */}
                        <div className="flex sticky top-0 bg-slate-100 z-30 border-b border-slate-200 shadow-sm">
                            {/* Label column header */}
                            <div className="sticky left-0 bg-slate-100 w-[240px] min-w-[240px] border-r border-slate-200 px-3 py-2 flex items-center z-40">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Recurso / Operação</span>
                            </div>
                            {/* Day headers */}
                            <div className="flex">
                                {dateArray.map((d, i) => {
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                    return (
                                        <div key={i} className={`flex-shrink-0 w-[40px] text-center border-r border-slate-200 py-1.5 flex flex-col justify-center ${isWeekend ? 'bg-slate-200/60' : 'bg-white'}`}>
                                            <span className="text-[8px] text-slate-400 font-bold uppercase leading-none">{['D','S','T','Q','Q','S','S'][d.getDay()]}</span>
                                            <span className={`text-[11px] font-bold leading-tight mt-0.5 ${isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>{d.getDate().toString().padStart(2, '0')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden w-max min-w-full pb-8">
                        {orderedGroups.map((group) => {
                            const plan = operationPlans[group.code];
                            if (!plan || !plan.selected) return null;

                            const sDate = plan.start ? new Date(plan.start + 'T00:00:00') : null;
                            const eDate = plan.end   ? new Date(plan.end   + 'T00:00:00') : null;
                            const isUnplanned = !sDate || !eDate;

                            let baselineLeftPx = 0, baselineWidthPx = 0;
                            let hasDiff = false;
                            if (plan.baselineStart && plan.baselineEnd) {
                                const bsDate = new Date(plan.baselineStart + 'T00:00:00');
                                const beDate = new Date(plan.baselineEnd   + 'T00:00:00');
                                const bStartDiff = Math.ceil((bsDate - minDate) / (1000 * 60 * 60 * 24));
                                const bEndDiff   = Math.ceil((beDate - bsDate)  / (1000 * 60 * 60 * 24)) + 1;
                                baselineLeftPx  = bStartDiff * CELL_WIDTH;
                                baselineWidthPx = Math.max(bEndDiff * CELL_WIDTH, CELL_WIDTH);
                                if (plan.start !== plan.baselineStart || plan.end !== plan.baselineEnd) hasDiff = true;
                            }

                            return (
                                <div
                                    key={group.code}
                                    className="flex relative border-b border-slate-200 group/gantt hover:bg-blue-50/20 transition-colors shrink-0"
                                    style={{ height: `${ROW_H}px` }}
                                >
                                    {/* Sticky Label */}
                                    <div className="sticky left-0 bg-white group-hover/gantt:bg-slate-50/80 w-[240px] min-w-[240px] border-r border-slate-200 px-2 flex items-center z-20 shadow-[2px_0_4px_rgba(0,0,0,0.04)] gap-2">
                                        {/* Estado locked */}
                                        {plan.locked && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Concluído" />}
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex flex-wrap items-center gap-1">
                                                <span className="font-mono text-[9px] font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 leading-none truncate max-w-[72px]" title={group.code}>{group.code}</span>
                                                {plan.isAlreadyPlanned
                                                    ? <span className="text-[6px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 uppercase leading-none">Salvo</span>
                                                    : <span className="text-[6px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 uppercase leading-none">Novo</span>
                                                }
                                            </div>
                                            <span className="text-[10px] text-slate-600 font-medium overflow-hidden text-ellipsis whitespace-nowrap mt-0.5" title={group.desc}>{group.desc}</span>
                                        </div>
                                    </div>

                                    {/* Track Area */}
                                    <div className="relative flex-1" style={{ width: dateArray.length * CELL_WIDTH + 'px' }}>

                                        {/* Background grid */}
                                        <div className="absolute inset-0 flex pointer-events-none z-0">
                                            {dateArray.map((d, i) => (
                                                <div key={i} className={`flex-shrink-0 w-[40px] border-r border-slate-100 h-full ${(d.getDay() === 0 || d.getDay() === 6) ? 'bg-slate-100/50' : ''}`} />
                                            ))}
                                        </div>

                                        {/* Baseline strip */}
                                        {plan.baselineStart && plan.baselineEnd && hasDiff && (
                                            <div
                                                className="absolute h-[4px] bg-slate-400/50 rounded-sm z-10"
                                                style={{
                                                    top: `${BAR_TOP + BAR_H + 2}px`,
                                                    left: `${baselineLeftPx}px`,
                                                    width: `${baselineWidthPx}px`
                                                }}
                                                title={`Salvo anteriormente: ${plan.baselineStart.split('-').reverse().join('/')} �  ${plan.baselineEnd.split('-').reverse().join('/')}`}
                                            />
                                        )}

                                        {/* Unplanned placeholder */}
                                        {isUnplanned && (
                                            <div className="absolute inset-y-0 left-0 flex items-center px-4 gap-2 pointer-events-none">
                                                <div className="h-[6px] w-28 border-2 border-dashed border-slate-300 rounded-full opacity-50" />
                                                <span className="text-[9px] text-slate-400 font-medium italic whitespace-nowrap">Não planejado</span>
                                            </div>
                                        )}

                                        {/* Main bar */}
                                        {sDate && eDate && (() => {
                                            const isDraggingThis = draggingBar?.code === group.code;
                                            const ghostOffsetDays = isDraggingThis ? draggingBar.offsetDays : 0;

                                            const segments = [];
                                            const cur = new Date(sDate);
                                            cur.setHours(0, 0, 0, 0);
                                            const endD = new Date(eDate);
                                            endD.setHours(0, 0, 0, 0);

                                            while (cur <= endD) {
                                                const dow = cur.getDay();
                                                const isNonWorking = daysMode === 'business' && ((!includeSunday && dow === 0) || (!includeSaturday && dow === 6));
                                                const daysFromMin = Math.round((cur.getTime() - minDate.getTime()) / 86400000);
                                                segments.push({ leftPx: (daysFromMin + ghostOffsetDays) * CELL_WIDTH, isNonWorking });
                                                cur.setDate(cur.getDate() + 1);
                                            }

                                            const solidCls = plan.locked
                                                ? 'bg-green-500 border-green-600'
                                                : hasDiff
                                                    ? 'bg-amber-400 border-amber-500'
                                                    : 'bg-blue-500 border-blue-600';
                                            const dashCls = plan.locked
                                                ? 'border-green-400 bg-green-100/60'
                                                : hasDiff
                                                    ? 'border-amber-400 bg-amber-50/60'
                                                    : 'border-blue-400 bg-blue-50/40';
                                            const cursorCls = plan.locked
                                                ? 'cursor-not-allowed z-10'
                                                : isDraggingThis
                                                    ? 'cursor-grabbing z-50'
                                                    : 'cursor-grab z-10';

                                            // Largura total da barra em px (para decidir onde mostrar label)
                                            const totalWidthPx = segments.length * CELL_WIDTH;
                                            // Mostra o label de dias se a barra tiver ao menos 2 células
                                            const showDayLabel = segments.length >= 2;
                                            // Posição do primeiro segmento
                                            const firstLeftPx = segments[0]?.leftPx ?? 0;

                                            return (
                                                <div
                                                    onMouseDown={(e) => handleGanttBarMouseDown(e, group.code)}
                                                    className={`absolute select-none ${cursorCls}`}
                                                    style={{ top: 0, left: 0, right: 0, bottom: 0 }}
                                                >
                                                    {/* Segmentos de cor */}
                                                    {segments.map((seg, idx) => {
                                                        const isFirst = idx === 0;
                                                        const isLast  = idx === segments.length - 1;
                                                        const roundL  = isFirst ? 'rounded-l-md' : '';
                                                        const roundR  = isLast  ? 'rounded-r-md' : '';

                                                        return seg.isNonWorking ? (
                                                            <div
                                                                key={idx}
                                                                className={`absolute border-2 border-dashed ${dashCls} ${roundL} ${roundR}`}
                                                                style={{ top: `${BAR_TOP}px`, height: `${BAR_H}px`, left: `${seg.leftPx}px`, width: `${CELL_WIDTH}px` }}
                                                                title="Fim de semana � não contabilizado"
                                                            />
                                                        ) : (
                                                            <div
                                                                key={idx}
                                                                className={`absolute border ${solidCls} ${roundL} ${roundR} shadow-sm ${isDraggingThis ? 'ring-2 ring-white/40' : ''}`}
                                                                style={{ top: `${BAR_TOP}px`, height: `${BAR_H}px`, left: `${seg.leftPx}px`, width: `${CELL_WIDTH}px` }}
                                                            />
                                                        );
                                                    })}

                                                    {/* Overlay de interação: drag handle + input de dias centralizado na barra */}
                                                    {segments.length > 0 && (
                                                        <div
                                                            className="absolute flex items-center gap-1 px-1.5"
                                                            style={{ top: `${BAR_TOP}px`, height: `${BAR_H}px`, left: `${firstLeftPx}px`, width: `${totalWidthPx}px` }}
                                                        >
                                                            {/* Ícone de arrastar � sempre visível ao hover */}
                                                            {!plan.locked && (
                                                                <GripVertical className={`w-3.5 h-3.5 shrink-0 ${hasDiff ? 'text-amber-100' : 'text-blue-200'} opacity-80`} />
                                                            )}

                                                            {/* Input de dias com label "d" � editável direto na barra */}
                                                            <div className="flex items-center gap-0.5 flex-1 justify-center" onMouseDown={e => e.stopPropagation()}>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={plan.duracao}
                                                                    onChange={e => updateOperationDuration(group.code, e.target.value)}
                                                                    readOnly={plan.locked}
                                                                    className={`w-8 bg-transparent text-center font-extrabold text-[12px] outline-none appearance-none border-none shadow-none
                                                                        ${plan.locked ? 'cursor-not-allowed' : 'cursor-text hover:bg-white/20 rounded focus:bg-white/30 focus:ring-1 focus:ring-white/60'}
                                                                        ${hasDiff ? 'text-amber-900' : 'text-white'}`}
                                                                    style={{ MozAppearance: 'textfield' }}
                                                                    title="Clique para editar duração em dias"
                                                                />
                                                                {showDayLabel && (
                                                                    <span className={`text-[10px] font-bold leading-none ${hasDiff ? 'text-amber-800/80' : 'text-white/70'}`}>d</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <><div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-50 shadow-2xl w-[98vw] max-w-[1800px] h-[95vh] flex flex-col overflow-hidden border border-slate-300 rounded-lg">
                
                {/* Header Navbar */}
                <div className="px-3 py-2 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-normal">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Planejamento Sequencial
                            <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded font-mono">OP {op.op}</span>
                        </h2>

                        {/* Indicador de Folga até Entrega */}
                        {deliverySlack !== null && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                deliverySlack >= 5  ? 'bg-green-50 text-green-700 border-green-200' :
                                deliverySlack >= 1  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                     'bg-red-50 text-red-700 border-red-200'
                            }`}>
                                {deliverySlack >= 1
                                    ? <><CheckCircle className="w-3 h-3" /> Folga: +{deliverySlack}d</>  
                                    : <><AlertTriangle className="w-3 h-3" /> {deliverySlack === 0 ? 'No limite' : `Atrasado: ${deliverySlack}d`}</> }
                            </div>
                        )}

                        {/* Indicador de Alterações Não Salvas */}
                        {hasUnsavedChanges && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> Não salvo
                            </span>
                        )}
                        {lastSavedAt && !hasUnsavedChanges && (
                            <span className="flex items-center gap-1 text-[9px] font-medium text-green-600">
                                <CheckCircle className="w-3 h-3" /> Salvo {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
                            <button onClick={() => setViewMode('list')} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Lista</button>
                            <button onClick={() => setViewMode('gantt')} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'gantt' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Gantt</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Botão Histórico */}
                        <button
                            onClick={() => { setShowHistory(h => { if (!h) loadHistory(); return !h; }); }}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                showHistory ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                            title="Histórico de versões"
                        >
                            <History className="w-3.5 h-3.5" /> Hist�rico
                        </button>
                        <button
                            onClick={() => setShowHelp(h => !h)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                showHelp ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                            }`}
                            title="Ajuda - Como usar o Planejamento Sequencial"
                        >
                            <HelpCircle className="w-3.5 h-3.5" /> Ajuda
                        </button>
                        <button onClick={() => {
                            if (hasUnsavedChanges) {
                                if (!confirm('Há alterações não salvas. Deseja fechar mesmo assim?')) return;
                            }
                            onClose();
                        }} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
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
                                    value={targetEndDate}
                                    onChange={e => handleAnchorDateChange('end', e.target.value)}
                                    className="border border-blue-200 bg-blue-50 text-blue-900 text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2 fade-in">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Data Inicial (Fabricar):</label>
                                <input
                                    type="date"
                                    value={targetStartDate}
                                    onChange={e => handleAnchorDateChange('start', e.target.value)}
                                    className="border border-green-200 bg-green-50 text-green-900 text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-green-500 font-bold"
                                />
                            </div>
                        )}

                        {/* Compactar Datas button */}
                        <button
                            onClick={handleRepackCascade}
                            title="Compacta todas as operações em cascata a partir da data alvo, removendo gaps/espaços"
                            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                            <MoveUp className="w-3 h-3" /> Compactar
                        </button>
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
                            <Briefcase className="w-3 h-3" /> �ateis
                        </button>
                        <label className={`flex items-center gap-1 cursor-pointer text-[9px] font-bold uppercase tracking-tight select-none transition-colors ml-1 pr-1 border-l border-slate-200 pl-1 ${daysMode === 'business' ? 'text-slate-600 hover:text-blue-600' : 'text-slate-300 pointer-events-none'}`}>
                            <input 
                                type="checkbox" 
                                checked={includeSaturday} 
                                disabled={daysMode !== 'business'}
                                onChange={(e) => {
                                    const v = e.target.checked;
                                    setIncludeSaturday(v);
                                    saveCustomLayout(orderedGroups, calcDirection, { includeSaturday: v });
                                    triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, v, includeSunday, joinedCodes);
                                }}
                                className={`w-3 h-3 rounded focus:ring-blue-500 cursor-pointer ${daysMode === 'business' ? 'text-blue-600 border-slate-300' : 'text-slate-300 border-slate-200 bg-slate-100'}`}
                            />
                            Incluir Sábado?
                        </label>
                        <label className={`flex items-center gap-1 cursor-pointer text-[9px] font-bold uppercase tracking-tight select-none transition-colors pr-1 border-l border-slate-200 pl-1 ${daysMode === 'business' ? 'text-slate-600 hover:text-blue-600' : 'text-slate-300 pointer-events-none'}`}>
                            <input 
                                type="checkbox" 
                                checked={includeSunday} 
                                disabled={daysMode !== 'business'}
                                onChange={(e) => {
                                    const v = e.target.checked;
                                    setIncludeSunday(v);
                                    saveCustomLayout(orderedGroups, calcDirection, { includeSunday: v });
                                    triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, includeSaturday, v, joinedCodes);
                                }}
                                className={`w-3 h-3 rounded focus:ring-blue-500 cursor-pointer ${daysMode === 'business' ? 'text-blue-600 border-slate-300' : 'text-slate-300 border-slate-200 bg-slate-100'}`}
                            />
                            Incluir Domingo?
                        </label>
                    </div>

                    {/* ST Services Toggle */}
                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600 uppercase tracking-tight select-none hover:text-blue-600 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={includeST} 
                                onChange={(e) => {
                                    const v = e.target.checked;
                                    setIncludeST(v);
                                    saveCustomLayout(orderedGroups, calcDirection, { includeST: v });
                                    triggerRecalculation(operationPlans, orderedGroups, calcDirection, v, includeSaturday, includeSunday, joinedCodes);
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

                            {/* FIX #3: Banner de alerta quando lote mistura ops salvas e novas */}
                            {(() => {
                                const hasPlanned   = orderedGroups.some(g => operationPlans[g.code]?.isAlreadyPlanned);
                                const hasUnplanned = orderedGroups.some(g => !operationPlans[g.code]?.isAlreadyPlanned);
                                if (!hasPlanned || !hasUnplanned) return null;
                                return (
                                    <div className="mx-1 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 shrink-0">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <span className="text-[10px] text-amber-700 font-medium leading-snug">
                                            Este lote contém operações <strong>já salvas no banco</strong> (badge azul � serão <em>sobrescritas</em>) e operações <strong>novas sem histórico</strong> (badge âmbar). Verifique antes de salvar.
                                        </span>
                                    </div>
                                );
                            })()}

                            {/* Linha vertical de progressão sequencial */}
                            <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 to-indigo-200 z-0"></div>

                            {(previewGroups || orderedGroups).map((group, index) => {
                                const displayGroups = previewGroups || orderedGroups;
                                const plan = operationPlans[group.code] || { start: '', end: '', selected: false, baselineStart: '', baselineEnd: '', isAlreadyPlanned: false };
                                const isExpanded = expandedOps[group.code];
                                const prevCode = index > 0 ? displayGroups[index - 1]?.code : null;
                                const isJoined = prevCode ? joinedCodes.has(prevCode) : false;
                                const isNextJoined = joinedCodes.has(group.code);
                                const isBeingDragged = draggedIndex === index;
                                // FIX #3: Detecta transição de seção para separador visual
                                const prevPlan = prevCode ? operationPlans[prevCode] : null;
                                const showNewSectionDivider = !plan.isAlreadyPlanned && (index === 0 || prevPlan?.isAlreadyPlanned);

                                return (
                                    <React.Fragment key={group.code}>
                                        {/* FIX #3: Separador "A Planejar" quando transiciona de salvo �  novo */}
                                        {showNewSectionDivider && index > 0 && (
                                            <div className="flex items-center gap-2 my-2 mx-1">
                                                <div className="flex-1 h-px bg-amber-200" />
                                                <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded-full">
                                                    <Plus className="w-2.5 h-2.5" /> A Planejar (novo)
                                                </span>
                                                <div className="flex-1 h-px bg-amber-200" />
                                            </div>
                                        )}

                                        {index > 0 && !(showNewSectionDivider && index > 0) && (
                                            <div className="relative h-2 flex items-center z-20 -my-1 -ml-1">
                                                <button onClick={() => toggleJoin(index)}
                                                    className={`absolute left-[40px] p-[2px] transition-all
                                                    ${isJoined ? 'text-blue-500 bg-white border border-blue-200 rounded' 
                                                    : 'text-slate-300 hover:text-blue-400 opacity-50 hover:opacity-100'}`}
                                                    title={isJoined ? `Desvincular paralelo com "${prevCode}"` : 'Unir Fluxo de Tempo (executar em paralelo)'}
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
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 leading-none" title={group.code}>
                                                            {group.code}
                                                        </span>
                                                        {/* FIX #3: Badge de estado (salvo vs novo) */}
                                                        {plan.isAlreadyPlanned ? (
                                                            <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 uppercase leading-none" title="Esta operação já tem planejamento salvo no banco � será sobrescrita">Salvo</span>
                                                        ) : (
                                                            <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 uppercase leading-none" title="Esta operação ainda não tem planejamento no banco">Novo</span>
                                                        )}
                                                        {/* FIX #3: Aviso de duração zero � causaria colapso de datas */}
                                                        {plan.selected && (parseInt(plan.duracao) || 0) === 0 && (
                                                            <span title="Duração zero: não consumirá tempo no sequenciamento � todas as ops seguintes colapsarão nesta data" className="text-[7px] text-orange-600 font-bold bg-orange-50 border border-orange-200 px-1 py-0.5 rounded leading-none">�a� 0d</span>
                                                        )}
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
                                                <input type="date" value={plan.start ? plan.start.split('T')[0] : ''} 
                                                    onChange={e => { 
                                                        const newStart = e.target.value;
                                                        setOperationPlans(p => {
                                                            const updated = {...p, [group.code]: {...p[group.code], start: newStart, manuallySet: true}};
                                                            // Calculate new end based on duration
                                                            if (newStart && updated[group.code].duracao > 0) {
                                                                const base = safeDate(newStart);
                                                                const end = addDays(base, updated[group.code].duracao - 1, daysMode, includeSaturday, includeSunday);
                                                                updated[group.code].end = (daysMode === 'business' ? skipToWorkday(end, true, includeSaturday, includeSunday) : end).toISOString().split('T')[0];
                                                            }
                                                            return updated;
                                                        });
                                                    }} 
                                                    disabled={!plan.selected}
                                                    className={`w-[66px] text-[9px] px-0.5 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center ${plan.start !== plan.baselineStart ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`} />
                                                <span className="text-slate-300 text-[10px]">&gt;</span>
                                                <input type="date" value={plan.end ? plan.end.split('T')[0] : ''} 
                                                    onChange={e => { 
                                                        const newEnd = e.target.value;
                                                        setOperationPlans(p => {
                                                            const updated = {...p, [group.code]: {...p[group.code], end: newEnd, manuallySet: true}};
                                                            // Calculate new start based on duration
                                                            if (newEnd && updated[group.code].duracao > 0) {
                                                                const base = safeDate(newEnd);
                                                                const start = subtractDays(base, updated[group.code].duracao - 1, daysMode, includeSaturday, includeSunday);
                                                                updated[group.code].start = (daysMode === 'business' ? skipToWorkday(start, false, includeSaturday, includeSunday) : start).toISOString().split('T')[0];
                                                            }
                                                            return updated;
                                                        });
                                                    }} 
                                                    disabled={!plan.selected}
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

                {/* Barra de Progresso do Plano */}
                {planProgress.total > 0 && (
                    <div className="px-3 py-1 bg-slate-900 border-t border-slate-700 flex items-center gap-3 shrink-0">
                        <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                            {planProgress.done}/{planProgress.total} operações planejadas
                        </span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${planProgress.pct}%`,
                                    background: planProgress.pct === 100 ? '#22c55e' : planProgress.pct >= 50 ? '#3b82f6' : '#f59e0b'
                                }}
                            />
                        </div>
                        <span className="text-[9px] font-bold text-slate-300">{planProgress.pct}%</span>
                    </div>
                )}

                {/* Footer NavBar */}
                <div className="px-3 py-2 bg-slate-800 flex justify-between items-center rounded-b-lg shrink-0">
                    <div className="text-[9px] text-slate-400 font-medium tracking-wide flex items-center gap-2">
                        <GripVertical className="w-3 h-3 text-slate-500" />
                        <span>Arraste as operações para reordenar o fluxo</span>
                        <span className="opacity-40 hidden sm:inline">| Ctrl+S para salvar</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-[10px] font-bold text-white transition-colors flex items-center gap-1.5 border border-slate-500">
                            <Printer className="w-3 h-3" /> Imprimir
                        </button>
                        <button onClick={() => {
                            if (hasUnsavedChanges) {
                                if (!confirm('Há alterações não salvas. Deseja fechar mesmo assim?')) return;
                            }
                            onClose();
                        }} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold text-white transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className={`px-4 py-1.5 rounded text-[10px] font-bold text-white flex items-center gap-1.5 transition-all shadow-lg disabled:opacity-50 border ${
                                hasUnsavedChanges
                                    ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 shadow-amber-900/40 animate-pulse'
                                    : 'bg-blue-600 hover:bg-blue-500 border-blue-500 shadow-blue-900/50'
                            }`}
                        >
                            {loading ? 'Salvando...' : <><Save className="w-3.5 h-3.5" />{hasUnsavedChanges ? ' Salvar Alterações' : ' Salvar'}</>}
                        </button>
                    </div>
                </div>

            </div>
        </div>

        {/* ���� Dialog de Confirmação de Salvamento ������������������������������������������������������ */}
        {showSaveDialog && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-[440px] border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header do Dialog */}
                    <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2">
                        <Save className="w-4 h-4 text-white" />
                        <span className="text-sm font-bold text-white uppercase tracking-wide">Confirmar Planejamento</span>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Resumo do plano */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">OP</span>
                                <span className="font-bold text-slate-700 font-mono">{op.op}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Modo</span>
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${calcDirection === 'backward' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                    {calcDirection === 'backward' ? '� � Regressivo' : '�  Progressivo'}
                                </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Operações</span>
                                <span className="font-bold text-slate-700">{planProgress.done} planejadas</span>
                            </div>
                            {(targetEndDate || targetStartDate) && (
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500 font-medium">Data âncora</span>
                                    <span className="font-bold text-slate-700 font-mono">
                                        {(targetEndDate || targetStartDate)?.split('-').reverse().join('/')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Campo de Observação */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Observação <span className="text-slate-400 font-normal normal-case tracking-normal">(opcional)</span>
                            </label>
                            <textarea
                                value={saveObservacao}
                                onChange={e => setSaveObservacao(e.target.value)}
                                placeholder="Ex: Revisão urgente cliente X � antecipado 3 dias..."
                                rows={3}
                                autoFocus
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder-slate-300"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Esta observação será salva no histórico de versões.</p>
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
                        <button
                            onClick={() => setShowSaveDialog(false)}
                            className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmSave}
                            className="px-5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 shadow-md shadow-blue-900/30"
                        >
                            <Save className="w-3.5 h-3.5" /> Confirmar e Salvar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Sidebar de Historico de Versoes */}
        {showHistory && (
            <div className="fixed right-0 top-0 bottom-0 w-[340px] bg-white border-l border-slate-200 shadow-2xl z-[55] flex flex-col">
                <div className="px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-400" />
                        <span className="text-[12px] font-bold text-white uppercase">Historico OP {op.op}</span>
                    </div>
                    <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                    {historyLoading ? (
                        <div className="flex items-center justify-center h-32 text-slate-400"><Clock className="w-4 h-4 mr-2 animate-spin" /> Carregando...</div>
                    ) : historyData.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-[11px]">Nenhum historico encontrado</p>
                            <p className="text-[10px] mt-1 opacity-60">Salve um planejamento para criar a primeira versao</p>
                        </div>
                    ) : historyData.map((lote, idx) => {
                        const isOpen = expandedLote === lote.lote_id;
                        const criado = lote.criado_em ? new Date(lote.criado_em) : null;
                        const ops = lote.operacoes || [];
                        const inicioOp = ops.length > 0 ? ops[ops.length-1]?.data_inicio?.split('T')[0]?.split('-').reverse().join('/') : null;
                        const fimOp = ops.length > 0 ? ops[0]?.data_fim?.split('T')[0]?.split('-').reverse().join('/') : null;
                        return (
                            <div key={lote.lote_id} className={`bg-white border rounded-lg overflow-hidden ${isOpen ? 'border-blue-300 shadow-md' : 'border-slate-200'}`}>
                                <button onClick={() => setExpandedLote(isOpen ? null : lote.lote_id)} className="w-full px-3 py-2.5 flex items-start gap-2 text-left hover:bg-slate-50">
                                    <div className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${idx === 0 ? 'bg-blue-500' : 'bg-slate-400'}`}>{lote.revisao}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[10px] font-bold text-slate-700 truncate">{lote.usuario || 'planejador'}</span>
                                            <span className="text-[9px] text-slate-400 whitespace-nowrap shrink-0">{criado ? criado.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</span>
                                        </div>
                                        {lote.observacao && <p className="text-[10px] text-blue-600 italic truncate mt-0.5">"{lote.observacao}"</p>}
                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${lote.modo_calculo === 'backward' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{lote.modo_calculo === 'backward' ? '� Regres.' : '� Progress.'}</span>
                                            <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${lote.dias_modo === 'business' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{lote.dias_modo === 'business' ? 'Uteis' : 'Corridos'}</span>
                                            {lote.inclui_sabado && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-bold">+Sab</span>}
                                            {lote.inclui_domingo && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-bold">+Dom</span>}
                                            {lote.inclui_st && <span className="text-[8px] bg-orange-50 text-orange-600 px-1 py-0.5 rounded font-bold">+ST</span>}
                                            {inicioOp && fimOp && <span className="text-[9px] text-slate-400">{inicioOp}-{fimOp}</span>}
                                            <span className="text-[8px] text-slate-400">{ops.length} ops</span>
                                        </div>
                                    </div>
                                    <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 mt-0.5 ${isOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isOpen && (
                                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 space-y-2">
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {ops.map((o, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-[9px] text-slate-600">
                                                    <span className="font-mono bg-white border border-slate-200 px-1 rounded text-[8px] text-slate-500 shrink-0">{o.recurso_code || o.operacao_codigo}</span>
                                                    <span className="text-slate-500 flex-1 truncate">{o.recurso_desc || ''}</span>
                                                    <span className="text-slate-400 whitespace-nowrap">{o.data_inicio?.split('T')[0]?.split('-').reverse().join('/') } {o.data_fim?.split('T')[0]?.split('-').reverse().join('/' )}</span>
                                                    {o.duracao_dias && <span className="text-slate-400">({o.duracao_dias}d)</span>}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => handleRestoreLote(lote)} className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1.5">
                                            <RotateCcw className="w-3 h-3" /> Restaurar este plano
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="px-3 py-2 border-t border-slate-200 shrink-0">
                    <p className="text-[9px] text-slate-400 text-center">Ultimas {historyData.length} versoes - Restaurar nao salva automaticamente</p>
                </div>
            </div>
        )}

        {/*    Painel de Ajuda Contextual                                     */}
        {showHelp && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{background:'rgba(15,23,42,0.7)', backdropFilter:'blur(4px)'}}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                    {/* Header */}
                    <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-emerald-600 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-[15px] font-bold text-white">Guia do Planejamento Sequencial</h2>
                                <p className="text-emerald-100 text-[11px]">Documenta&ccedil;&atilde;o completa de todas as funcionalidades</p>
                            </div>
                        </div>
                        <button onClick={() => setShowHelp(false)} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">

                        {/* O QUE E */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center"><Zap className="w-4 h-4 text-blue-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">O que &eacute; o Planejamento Sequencial?</h3>
                            </div>
                            <p className="text-[12px] text-slate-600 leading-relaxed">
                                O <strong>Planejamento Sequencial</strong> &eacute; a ferramenta central de programa&ccedil;&atilde;o da produ&ccedil;&atilde;o. Ele permite definir, de forma visual e interativa,
                                <strong> quando cada opera&ccedil;&atilde;o de uma OP ser&aacute; executada</strong>, em qual recurso (m&aacute;quina/centro de trabalho), por quantos dias e em que sequ&ecirc;ncia.
                                Ao salvar, as datas s&atilde;o gravadas no banco de dados e ficam vis&iacute;veis para todos os usu&aacute;rios do sistema.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {[['Azul','Opera&ccedil;&atilde;o planejada normal','bg-blue-100 text-blue-700'],['Amarelo/laranja','Datas alteradas vs. baseline','bg-amber-100 text-amber-700'],['Verde','Opera&ccedil;&atilde;o conclu&iacute;da (bloqueada)','bg-green-100 text-green-700'],['Cinza','Opera&ccedil;&atilde;o n&atilde;o selecionada','bg-slate-100 text-slate-500']].map(([cor, desc, cls]) => (
                                    <span key={cor} className={`text-[10px] px-2 py-1 rounded-full font-medium ${cls}`} dangerouslySetInnerHTML={{__html: `<b>${cor}:</b> ${desc}`}} />
                                ))}
                            </div>
                        </section>

                        {/* DIRECAO */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center"><ArrowRight className="w-4 h-4 text-indigo-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">1. Dire&ccedil;&atilde;o do Sequenciamento</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-[11px] font-bold text-blue-700 mb-1">&#8592; Regressivo (padr&atilde;o)</p>
                                    <p className="text-[11px] text-slate-600">O c&aacute;lculo parte da <strong>Data Final (Entrega)</strong> e distribui as opera&ccedil;&otilde;es de tr&aacute;s para frente. Use quando voc&ecirc; sabe a data de entrega e quer descobrir quando come&ccedil;ar.</p>
                                </div>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-[11px] font-bold text-green-700 mb-1">&#8594; Progressivo</p>
                                    <p className="text-[11px] text-slate-600">O c&aacute;lculo parte da <strong>Data Inicial (Fabrica&ccedil;&atilde;o)</strong> e distribui as opera&ccedil;&otilde;es em sequ&ecirc;ncia para frente. Use quando voc&ecirc; j&aacute; sabe quando pode come&ccedil;ar.</p>
                                </div>
                            </div>
                        </section>

                        {/* DATA ANCORA */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center"><Calendar className="w-4 h-4 text-slate-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">2. Data &Acirc;ncora e Compactar Datas</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 text-[12px] text-slate-600">
                                    <span className="shrink-0 mt-0.5 w-5 h-5 bg-slate-800 text-white rounded-full flex items-center justify-center text-[9px] font-bold">1</span>
                                    <p><strong>Data de Entrega / Data de In&iacute;cio:</strong> &Eacute; a data &acirc;ncora do plano. Ao alter&aacute;-la, <strong>todas as opera&ccedil;&otilde;es s&atilde;o deslocadas proporcionalmente</strong> mantendo os intervalos entre elas. Nenhuma opera&ccedil;&atilde;o &eacute; reagrupada automaticamente.</p>
                                </div>
                                <div className="flex items-start gap-3 text-[12px] text-slate-600">
                                    <span className="shrink-0 mt-0.5 w-5 h-5 bg-amber-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold">2</span>
                                    <p><strong>Bot&atilde;o &ldquo;Compactar&rdquo; (&#9650;):</strong> Remove todos os espa&ccedil;os/folgas entre as opera&ccedil;&otilde;es e as reagrupa em cascata a partir da data &acirc;ncora. &Uacute;til quando h&aacute; lacunas indesejadas entre recursos. <em>Solicita confirma&ccedil;&atilde;o antes de executar.</em></p>
                                </div>
                            </div>
                        </section>

                        {/* MODO DE DIAS */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center"><Briefcase className="w-4 h-4 text-amber-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">3. Modo de Contagem de Dias</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <p className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Dias Corridos</p>
                                    <p className="text-[11px] text-slate-500">Conta todos os dias do calend&aacute;rio, incluindo s&aacute;bados e domingos. Ideal para prazos de entrega.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <p className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3" /> Dias &Uacute;teis</p>
                                    <p className="text-[11px] text-slate-500">Conta apenas dias de semana (seg-sex). S&aacute;bado e domingo s&atilde;o pulados no c&aacute;lculo de dura&ccedil;&atilde;o.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <p className="text-[11px] font-bold text-slate-700 mb-1">+S&aacute;b / +Dom</p>
                                    <p className="text-[11px] text-slate-500">Dispon�vel no modo &ldquo;Dias &Uacute;teis&rdquo;. Adiciona s&aacute;bado e/ou domingo como dias &uacute;teis de trabalho.</p>
                                </div>
                            </div>
                            <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                                <p className="text-[11px] text-orange-700"><strong>Incluir &ldquo;ST&rdquo; no c&aacute;lculo:</strong> Quando ativo, opera&ccedil;&otilde;es do tipo Servi&ccedil;o de Terceiros (c&oacute;digo &ldquo;ST&rdquo;) s&atilde;o inclu&iacute;das no sequenciamento. Por padr&atilde;o ficam fora pois n&atilde;o dependem da f&aacute;brica.</p>
                            </div>
                        </section>

                        {/* VISUALIZACAO */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center"><MousePointer className="w-4 h-4 text-purple-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">4. Visualiza&ccedil;&atilde;o: Lista vs. Gantt</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[11px] font-bold text-slate-700 mb-2">Modo Lista</p>
                                    <ul className="space-y-1.5">
                                        {['Exibe cada recurso como uma linha com inputs de data e dura&ccedil;&atilde;o','Clique no recurso para expandir e ver todas as OPs vinculadas','Edite a dura&ccedil;&atilde;o em dias diretamente no campo ou nos bot&otilde;es +/&#8211;','Datas de in&iacute;cio e fim edit&aacute;veis por campos de data','Marque/desmarque opera&ccedil;&otilde;es para incluir ou excluir do planejamento'].map((t,i) => (
                                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                                <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                                <span dangerouslySetInnerHTML={{__html:t}} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-700 mb-2">Modo Gantt</p>
                                    <ul className="space-y-1.5">
                                        {['Visualiza&ccedil;&atilde;o gr&aacute;fica com barras de tempo por recurso','<strong>Arraste as barras</strong> horizontalmente para mover as datas','Clique e segure na barra para iniciar o arrasto','A barra muda de cor (laranja) quando difere do baseline','Fim de semana destacado em cinza (modo dias &uacute;teis)'].map((t,i) => (
                                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                                <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                                <span dangerouslySetInnerHTML={{__html:t}} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* VINCULACAO */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-teal-100 rounded-lg flex items-center justify-center"><Link className="w-4 h-4 text-teal-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">5. Vincular Opera&ccedil;&otilde;es (Grupos)</h3>
                            </div>
                            <p className="text-[12px] text-slate-600 mb-3">
                                O bot&atilde;o <strong>&#128279; Vincular</strong> permite agrupar dois ou mais recursos para que ocupem o mesmo intervalo de datas no planejamento &mdash; &uacute;til quando m&uacute;ltiplas opera&ccedil;&otilde;es ocorrem em paralelo.
                            </p>
                            <ol className="space-y-1.5">
                                {['Clique em &ldquo;Vincular&rdquo; para entrar no modo de sele&ccedil;&atilde;o','Clique em 2 ou mais recursos que devem ter as mesmas datas','Clique novamente em &ldquo;Vincular&rdquo; para confirmar o grupo','Os recursos vinculados ficam marcados com &iacute;cone de corrente','Para desvincular, selecione o grupo e clique em &ldquo;Desvincular&rdquo;'].map((t,i) => (
                                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                                        <span className="shrink-0 w-4 h-4 bg-teal-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold mt-0.5">{i+1}</span>
                                        <span dangerouslySetInnerHTML={{__html:t}} />
                                    </li>
                                ))}
                            </ol>
                        </section>

                        {/* REORDENACAO */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center"><GripVertical className="w-4 h-4 text-slate-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">6. Reordenar Opera&ccedil;&otilde;es (Drag &amp; Drop)</h3>
                            </div>
                            <p className="text-[12px] text-slate-600 mb-2">
                                A <strong>ordem dos recursos</strong> define a sequ&ecirc;ncia do c&aacute;lculo em cascata. Recursos no topo s&atilde;o executados primeiro (no modo Regressivo, s&atilde;o os &uacute;ltimos a encerrar).
                            </p>
                            <ul className="space-y-1.5">
                                {['Segure o &iacute;cone <b>&#9776;</b> (grip) e arraste a linha para cima ou para baixo','A ordem &eacute; salva automaticamente no banco de dados (compartilhada com outros usu&aacute;rios)','O recalculo da cascata s&oacute; ocorre ao soltar (n&atilde;o durante o arrasto) para evitar lentid&atilde;o','Bot&otilde;es &#9650; &#9660; tamb&eacute;m reordenam na vis&atilde;o lista'].map((t,i) => (
                                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                        <span dangerouslySetInnerHTML={{__html:t}} />
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* OPERACOES BLOQUEADAS */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center"><Lock className="w-4 h-4 text-green-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">7. Opera&ccedil;&otilde;es Bloqueadas (Conclu&iacute;das)</h3>
                            </div>
                            <p className="text-[12px] text-slate-600">
                                Recursos onde a <strong>quantidade produzida &ge; quantidade planejada</strong> aparecem bloqueados (c&iacute;clo verde com cadeado). Eles <strong>n&atilde;o participam do recalculo</strong> e suas datas n&atilde;o podem ser alteradas &mdash; garantindo integridade do hist&oacute;rico de produ&ccedil;&atilde;o j&aacute; realizada.
                            </p>
                        </section>

                        {/* HISTORICO */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center"><History className="w-4 h-4 text-blue-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">8. Hist&oacute;rico de Vers&otilde;es</h3>
                            </div>
                            <p className="text-[12px] text-slate-600 mb-3">
                                Clique em <strong>&ldquo;Hist&oacute;rico&rdquo;</strong> para abrir o painel lateral com todas as vers&otilde;es de planejamento salvas para esta OP. Cada vers&atilde;o (&ldquo;lote&rdquo;) mostra:
                            </p>
                            <ul className="space-y-1 text-[11px] text-slate-600">
                                {['Usu&aacute;rio que salvou e data/hora','Modo de c&aacute;lculo e prefer&ecirc;ncias usadas (dias &uacute;teis, s&aacute;bado, ST)','Intervalo total das opera&ccedil;&otilde;es','Detalhe por recurso (expandindo o card)','Bot&atilde;o &ldquo;Restaurar este plano&rdquo; &mdash; carrega as datas antigas na tela (requer salvar para confirmar)'].map((t,i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                        <CheckCircle className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
                                        <span dangerouslySetInnerHTML={{__html:t}} />
                                    </li>
                                ))}
                            </ul>
                        </section>

                        {/* SALVAR */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center"><Save className="w-4 h-4 text-blue-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">9. Salvar o Planejamento</h3>
                            </div>
                            <ol className="space-y-2">
                                {[
                                    'Clique em <strong>&ldquo;Salvar Planejamento&rdquo;</strong> na barra inferior.',
                                    'Uma janela de confirma&ccedil;&atilde;o exibe um resumo das opera&ccedil;&otilde;es a serem salvas.',
                                    'Adicione uma <strong>observa&ccedil;&atilde;o opcional</strong> descrevendo a revis&atilde;o (ex: &ldquo;Ajuste por falta de mat&eacute;ria-prima&rdquo;).',
                                    'Confirme. Os dados s&atilde;o gravados no banco de dados e <strong>vis&iacute;veis imediatamente para todos os usu&aacute;rios</strong>.',
                                    'As prefer&ecirc;ncias (modo de dias, ordem dos recursos) tamb&eacute;m s&atilde;o salvas e restauradas na pr&oacute;xima vez que qualquer usu&aacute;rio abrir esta OP.'
                                ].map((t,i) => (
                                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                                        <span className="shrink-0 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold mt-0.5">{i+1}</span>
                                        <span dangerouslySetInnerHTML={{__html:t}} />
                                    </li>
                                ))}
                            </ol>
                        </section>

                        {/* IMPRESSAO */}
                        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center"><Printer className="w-4 h-4 text-slate-600" /></div>
                                <h3 className="text-[13px] font-bold text-slate-800">10. Impress&atilde;o / Exportar PDF</h3>
                            </div>
                            <p className="text-[12px] text-slate-600">
                                O bot&atilde;o <strong>Imprimir</strong> gera um PDF do Gantt com o planejamento atual (mesmo que ainda n&atilde;o salvo), contendo todas as opera&ccedil;&otilde;es, datas e a linha do tempo visual. O arquivo &eacute; baixado automaticamente.
                            </p>
                        </section>

                        {/* ALERTAS */}
                        <section className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <h3 className="text-[13px] font-bold text-amber-800">Pontos de Aten&ccedil;&atilde;o</h3>
                            </div>
                            <ul className="space-y-2">
                                {[
                                    '<strong>N&atilde;o feche o modal sem salvar</strong> &mdash; o sistema alerta sobre altera&ccedil;&otilde;es n&atilde;o salvas, mas as datas n&atilde;o s&atilde;o enviadas automaticamente.',
                                    '<strong>Restaurar um plano hist&oacute;rico</strong> apenas carrega as datas na tela. &Eacute; necess&aacute;rio salvar novamente para que a restaura&ccedil;&atilde;o seja efetivada no banco.',
                                    '<strong>Compactar Datas</strong> &eacute; irrevers&iacute;vel na sess&atilde;o atual &mdash; use com cuidado em planos com espa&ccedil;amentos intencionais entre opera&ccedil;&otilde;es.',
                                    'O indicador <span class="bg-amber-100 text-amber-700 px-1 rounded text-[10px] font-bold">N&atilde;o salvo</span> pisca sempre que h&aacute; altera&ccedil;&otilde;es pendentes.'
                                ].map((t,i) => (
                                    <li key={i} className="flex items-start gap-2 text-[11px] text-amber-800">
                                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                        <span dangerouslySetInnerHTML={{__html:t}} />
                                    </li>
                                ))}
                            </ul>
                        </section>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                        <p className="text-[10px] text-slate-400">Planejamento Sequencial &mdash; MetalFisa PCP System</p>
                        <button onClick={() => setShowHelp(false)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors">
                            Entendido, fechar
                        </button>
                    </div>
                </div>
            </div>
        )}

        </>
    );
}
