import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Calendar, Save, CheckSquare, Square, ChevronDown, ChevronRight, GripVertical, MoveUp, MoveDown, Briefcase, Globe, Plus, Minus, Link, Printer, History, Clock, RotateCcw, AlertTriangle, CheckCircle, MessageSquare, ChevronLeft, HelpCircle, BookOpen, MousePointer, ArrowRight, Zap, Lock, RefreshCcw, Bot, Loader2, Shuffle, Pin, PinOff } from 'lucide-react';
import { useHelp } from '../contexts/HelpContext';
import { generateGanttPDF } from '../services/ganttPdfGenerator';
import { confirmApp, alertApp } from './GlobalConfirm';
import { getPlanningPrefs, getPlanningHistory, getRecursosOrdem, savePlanningPrefs } from '../services/api';

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
    const [saveAtualizarDataPcp, setSaveAtualizarDataPcp] = useState(false);

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

    // Agente Analista PCP IA
    const [showPcpAgent, setShowPcpAgent] = useState(false);
    const [pcpAgentAnalysis, setPcpAgentAnalysis] = useState(null);
    const [pcpAgentLoading, setPcpAgentLoading] = useState(false);
    const [pcpAgentError, setPcpAgentError] = useState(null);
    const [pcpAgentPinned, setPcpAgentPinned] = useState(false); // Fixa o painel: remove o fundo escurecido e o clique-fora-fecha

    // Agente Sequenciador PCP IA
    const [seqAgentLoading, setSeqAgentLoading] = useState(false);
    const [seqAgentResult, setSeqAgentResult] = useState(null);  // { suggestedOrder: string[], justification: string }
    const [showSeqPanel, setShowSeqPanel] = useState(false);
    const [seqAgentError, setSeqAgentError] = useState(null);

    // ── Auto-Save ─────────────────────────────────────────────────────────────
    const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
    const autoSaveTimerRef       = useRef(null);
    const isAutoSavingRef        = useRef(false);
    const performAutoSaveRef     = useRef(null);
    const lastAutoSaveTriggerRef = useRef(null); // null = ainda não inicializado

    const PREF_KEY = `macroPref_${op.op}`;

    // Nenhuma data do cronograma pode ficar no passado — nem a âncora escolhida
    // pelo usuário, nem o resultado calculado pela cascata.
    const todayStr = useMemo(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }, []);

    // 1. Agrupamento Inicial por Recurso
    // FIX SEQUÊNCIA: min_ordem_recurso vem persistido por operação (app_production_planning.ordem_recurso),
    // salvo junto com as datas no mesmo registro. É a fonte de verdade primária da ordem definida
    // pelo usuário — não depende de nenhuma preferência auxiliar para ser recuperada.
    const groupedByRecurso = useMemo(() => {
        const groups = {};
        operations.forEach(o => {
            const recursoCode = (o.recurso && o.recurso.trim() !== '') ? o.recurso.trim() : (o.operacao ? `OP-${o.operacao}` : 'S/R');
            if (!groups[recursoCode]) {
                groups[recursoCode] = {
                    code: recursoCode,
                    desc: o.desc_recurso || o.desc_operacao || '',
                    items: [],
                    min_sequen: 999999,
                    min_ordem_recurso: null
                };
            }
            groups[recursoCode].items.push(o);
            const seq = Number(o.sequen) || 999999;
            if (seq < groups[recursoCode].min_sequen) groups[recursoCode].min_sequen = seq;
            if (o.ordem_recurso !== null && o.ordem_recurso !== undefined) {
                const ord = Number(o.ordem_recurso);
                if (groups[recursoCode].min_ordem_recurso === null || ord < groups[recursoCode].min_ordem_recurso) {
                    groups[recursoCode].min_ordem_recurso = ord;
                }
            }
        });

        Object.values(groups).forEach(g => {
            const descricoes = Array.from(new Set(g.items.map(i => i.desc_recurso || i.desc_operacao).filter(Boolean)));
            g.desc = descricoes.join(' + ') || 'Sem descrição';
        });

        return Object.values(groups).sort((a, b) => {
            const aHas = a.min_ordem_recurso !== null;
            const bHas = b.min_ordem_recurso !== null;
            if (aHas && bHas) return a.min_ordem_recurso - b.min_ordem_recurso;
            if (aHas) return -1; // grupos com ordem salva vêm antes de grupos nunca sequenciados
            if (bHas) return 1;
            return a.min_sequen - b.min_sequen;
        });
    }, [operations]);

    // 2. Inicialização do Estado � Lê Baseline do Banco e carrega preferências do servidor
    useEffect(() => {
        // Reseta o auto-save ao re-inicializar (quando OPs/OP mudam)
        lastAutoSaveTriggerRef.current = null;
        isAutoSavingRef.current = false;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

        let isMounted = true;

        const initialize = async () => {
            const initialPlans = {};
            const initialExpanded = {};
            let initialEndDate = '';
            let initialStartDate = '';
            let groupsToUse = [...groupedByRecurso];
            let savedDirection = 'backward';
            let savedDaysMode = 'calendar';       // capturado das prefs
            let savedIncludeSaturday = false;     // capturado das prefs
            let savedIncludeSunday = false;       // capturado das prefs
            let savedIncludeST = false;           // capturado das prefs

            // ── Carrega preferências do SERVIDOR (compartilhado entre usuários) ──
            // FIX 401: usa services/api.js (axios com interceptor de Authorization)
            // em vez de fetch() cru — fetch() não anexava o Bearer token exigido por
            // /api/*, então essa leitura sempre falhava silenciosamente e a ordem
            // salva nunca era restaurada.
            const [prefsResult, recursosResult] = await Promise.allSettled([
                getPlanningPrefs(op.op),
                getRecursosOrdem()
            ]);

            if (recursosResult.status === 'fulfilled' && isMounted) {
                const recData = recursosResult.value;
                // Fix #3: normalize key to UPPER-TRIM to match backend
                const recMap = {};
                const grupoMap = {};
                recData.forEach(r => {
                    const key = (r.cod_recurso || '').trim().toUpperCase();
                    recMap[key] = r.ordem_exibicao ?? 9999;
                    if (r.grupo_paralelo) grupoMap[key] = r.grupo_paralelo;
                });

                groupsToUse.forEach(g => {
                    const key = (g.code || '').trim().toUpperCase();
                    g.ordem_exibicao = recMap[key] ?? 9999;
                    g.grupo_paralelo = grupoMap[key] || null;
                });

                // Fix #2: Unified sort that always respects both sources:
                //   1. ordem_recurso (saved per-operation in the DB) — highest priority
                //   2. ordem_exibicao (global, from pcp-refinado/capacidade) — tiebreaker
                //   3. min_sequen (Protheus operation code) — final fallback
                //
                // The OLD code only applied ordem_exibicao when ZERO groups had a
                // persisted order — meaning that after the first save, the global
                // configuration was completely ignored. This fix always applies it.
                groupsToUse.sort((a, b) => {
                    const aOrd = a.min_ordem_recurso ?? null;
                    const bOrd = b.min_ordem_recurso ?? null;
                    // Both have DB-persisted order → use it directly
                    if (aOrd !== null && bOrd !== null) {
                        if (aOrd !== bOrd) return aOrd - bOrd;
                        // Same persisted order → fall through to global
                    }
                    // Only one has persisted order → it wins
                    if (aOrd !== null && bOrd === null) return -1;
                    if (aOrd === null && bOrd !== null) return 1;
                    // Neither has persisted order → use global ordem_exibicao
                    const aGlob = a.ordem_exibicao ?? 9999;
                    const bGlob = b.ordem_exibicao ?? 9999;
                    if (aGlob !== bGlob) return aGlob - bGlob;
                    return a.min_sequen - b.min_sequen;
                });
            } else if (recursosResult.status === 'rejected') {
                console.warn('[PREFS] Erro ao carregar ordem global de recursos:', recursosResult.reason);
            }

            if (prefsResult.status === 'fulfilled') {
                const prefs = prefsResult.value;
                if (prefs && isMounted) {
                    if (prefs.diasModo)                         { setDaysMode(prefs.diasModo); savedDaysMode = prefs.diasModo; }
                    if (typeof prefs.incluiSabado === 'boolean') { setIncludeSaturday(prefs.incluiSabado); savedIncludeSaturday = prefs.incluiSabado; }
                    if (typeof prefs.incluiDomingo === 'boolean') { setIncludeSunday(prefs.incluiDomingo); savedIncludeSunday = prefs.incluiDomingo; }
                    if (typeof prefs.incluiST === 'boolean')     { setIncludeST(prefs.incluiST); savedIncludeST = prefs.incluiST; }

                    // Restaura ordem legada (lotes salvos antes da coluna ordem_recurso
                    // existir). Só aplica a grupos sem ordem persistida por operação.
                    if (prefs.ordemRecursos && Array.isArray(prefs.ordemRecursos)) {
                        const anyPersisted = groupsToUse.some(g => g.min_ordem_recurso !== null && g.min_ordem_recurso !== undefined);
                        if (!anyPersisted) {
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
            } else {
                console.warn('[PREFS] Erro ao carregar preferências do servidor:', prefsResult.reason);
            }

            // Auto-une recursos adjacentes do mesmo grupo paralelo (configurado em
            // Configurações → PCP Refinado → Capacidade de Recursos) — equivalente ao
            // botão "unir" manual do modal, mas pré-configurado uma vez para todo o app
            // em vez de precisar ser refeito a cada OP.
            const autoJoinedCodes = new Set();
            const joinedSetInit = new Set();
            groupsToUse.forEach((g, idx) => {
                if (idx === 0) return;
                const prev = groupsToUse[idx - 1];
                if (g.grupo_paralelo && prev.grupo_paralelo && g.grupo_paralelo === prev.grupo_paralelo) {
                    autoJoinedCodes.add(prev.code);
                    joinedSetInit.add(idx - 1);
                }
            });

            // 🗓️ Fallback: tenta localStorage apenas para direção (dir) 🗓️
            try {
                const saved = localStorage.getItem(PREF_KEY);
                if (saved) {
                    const local = JSON.parse(saved);
                    if (local.dir) savedDirection = local.dir;
                }
            } catch (e) { /* ignora */ }

            // 🗓️ Monta os planos iniciais com base nas datas já salvas 🗓️
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
                    // Usa o modo correto das prefs (já lidas acima) para calcular a duração salva
                    const loadedMode = savedDaysMode || 'calendar';
                    if (loadedMode === 'business') {
                        dur = Math.max(1, countBusinessDays(s, e, false));
                    } else {
                        // Dias corridos: diferença em dias + 1 (inclui o próprio dia de início e fim)
                        dur = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                    }

                    // FIX DEFINITIVO: operações concluídas (locked) podem ter datas antigas no banco
                    // (ex: 2037 de um planejamento anterior incorreto). Se incluídas no cálculo da
                    // âncora, contaminariam initialEndDate e fariam toda a cascata partir de 2037.
                    // Somente operações PENDENTES definem a data-âncora do cronograma.
                    const isGroupLocked = group.items.length > 0 && group.items.every(
                        i => Number(i.qtd_planejada_op) > 0 && Number(i.qtd_produzida_real) >= Number(i.qtd_planejada_op)
                    );

                    if (!isGroupLocked) {
                        if (!initialEndDate || existingEnd > initialEndDate) initialEndDate = existingEnd;
                        if (!initialStartDate || existingStart < initialStartDate) initialStartDate = existingStart;
                    }
                }

                // Restaura o estado do checkbox (ativo/inativo) salvo por operação.
                // selecionado === 0 é a única forma de "desmarcado" — null/undefined/1
                // significam ativo (default), preservando o comportamento anterior
                // para planos salvos antes desta coluna existir.
                const savedSelected = plannedItem?.selecionado !== 0;

                initialPlans[group.code] = {
                    start: existingStart,
                    end: existingEnd,
                    baselineStart: existingStart,
                    baselineEnd: existingEnd,
                    duracao: dur,
                    selected: savedSelected,
                    // Travada SOMENTE se TODOS os itens deste recurso já tiverem produção real
                    // confirmada. FIX: .some() travava o grupo inteiro (dezenas/centenas de itens,
                    // já que um lote pode juntar várias OPs no mesmo recurso) bastando UM item já
                    // produzido — mesmo com 90%+ do recurso ainda pendente, o grupo inteiro ficava
                    // congelado nas datas antigas e nunca mais recalculava. .every() só trava
                    // quando o recurso está de fato 100% concluído para este lote.
                    locked: group.items.length > 0 && group.items.every(i => Number(i.qtd_planejada_op) > 0 && Number(i.qtd_produzida_real) >= Number(i.qtd_planejada_op)),
                    isAlreadyPlanned: existingStart !== '',
                    // manuallySet deve ser false ao carregar:
                    // "já salvo no banco" NÃO significa "usuário fixou essa data".
                    // O usuário fixa uma data apenas quando clica e digita diretamente no campo.
                    // Com false, a cascata recalcula corretamente a partir da data âncora (entrega).
                    manuallySet: false,
                };
                initialExpanded[group.code] = false;
            });

            if (!isMounted) return;

            // ── Recalcula a cascata a partir da ordem (fonte de verdade) ─────
            // A sequência dos recursos é quem define o cálculo de datas — não o
            // contrário. O bug original nunca foi "a cascata recalcula", foi
            // "a cascata recalcula em cima da ORDEM ERRADA" (ordemRecursos não
            // era restaurada por causa do 401 em fetch()/sem auth — ver fix
            // acima). Com a ordem agora persistida por operação (ordem_recurso)
            // e as preferências (direção, dias úteis/corridos) restauradas
            // corretamente, recalcular aqui sempre produz datas consistentes
            // com a sequência exibida — que é exatamente o comportamento
            // esperado: mudou a ordem, as datas seguem a nova ordem.
            const anchorForCalc = savedDirection === 'backward' ? initialEndDate : initialStartDate;
            let plansToSet = initialPlans;
            if (anchorForCalc) {
                // joinedSetInit já reflete os grupos paralelos auto-unidos (calculado acima)
                plansToSet = calcRoutine({
                    isForward: savedDirection !== 'backward',
                    anchorDate: anchorForCalc,
                    plansList: initialPlans,
                    targetGroups: groupsToUse,
                    joinedSet: joinedSetInit,
                    incST: savedIncludeST,
                    incSat: savedIncludeSaturday,
                    incSun: savedIncludeSunday,
                    overrideDaysMode: savedDaysMode,
                });
            }

            setOperationPlans(plansToSet);
            setExpandedOps(initialExpanded);
            setOrderedGroups(groupsToUse);
            setJoinedCodes(autoJoinedCodes);
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

        const newPlans = {};
        Object.keys(plansList).forEach(k => {
            newPlans[k] = { ...plansList[k] };
        });

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
                // Operações locked não contribuem para a duração do bloco:
                // se contribuíssem, o cursor de data avançaria sem atualizar a op,
                // criando uma lacuna (gap) fantasma no cronograma.
                if (p && p.selected && !p.locked) maxDur = Math.max(maxDur, parseInt(p.duracao) || 0);
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
                    // Cascata normal — sempre atualiza, mesmo datas editadas manualmente e mesmo para
                    // operações concluídas (locked). O usuário solicitou que as datas calculadas sejam
                    // aplicadas mesmo em recursos já concluídos, para manter o cronograma consistente.
                    const normalizedEnd = dMode === 'business'
                        ? skipToWorkday(new Date(eDate), true, incSat, incSun)
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

    // Persiste preferências no banco imediatamente (silencioso, sem bloquear UI)
    const savePrefsToDB = useCallback((overrides = {}) => {
        const prefs = {
            diasModo:      overrides.diasModo      ?? daysMode,
            incluiSabado:  overrides.incluiSabado  ?? includeSaturday,
            incluiDomingo: overrides.incluiDomingo ?? includeSunday,
            incluiST:      overrides.incluiST      ?? includeST,
            ordemRecursos: orderedGroups.map(g => g.code),
        };
        savePlanningPrefs(op.op, prefs).catch(err =>
            console.warn('[PREFS-SAVE]', err.message)
        );
    }, [daysMode, includeSaturday, includeSunday, includeST, orderedGroups, op.op]);

    const toggleDaysMode = (mode) => {
        setDaysMode(mode);
        saveCustomLayout(orderedGroups, calcDirection, { daysMode: mode });
        savePrefsToDB({ diasModo: mode });
        triggerRecalculation(operationPlans, orderedGroups, calcDirection, includeST, includeSaturday, includeSunday, joinedCodes, undefined, undefined, mode);
    };

    // FIX REPLAN: Ao mudar a data âncora, DESLOCA todas as ops proporcionalmente
    // em vez de fazer tight-packing (cascata que destrói gaps existentes).
    const handleAnchorDateChange = (type, newVal) => {
        if (!newVal) return;
        if (newVal < todayStr) newVal = todayStr; // nenhuma data-âncora pode ficar no passado
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
    const handleRepackCascade = async () => {
        const ok = await confirmApp({
            title: 'Atenção',
            message: 'Isso irá compactar todas as operações em cascata a partir da data alvo, removendo espaços entre elas.\n\nConfirmar?'
        });
        if (!ok) return;
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

    const handleSave = () => {
        const anySelected = Object.values(operationPlans).some(p => p.selected && p.start && p.end);
        if (!anySelected) {
            alertApp('Nenhuma operação válida selecionada com datas definidas.');
            return;
        }



        setSaveObservacao('');
        setShowSaveDialog(true);
    };

    // ── Agente PCP IA: análise crítica do cronograma ──────────────────────────
    const runPcpAgentAnalysis = async () => {
        const plannedOps = orderedGroups
            .map(g => ({ ...operationPlans[g.code], recurso: g.code, descricao: g.desc }))
            .filter(p => p.selected && p.start && p.end);

        if (plannedOps.length === 0) {
            alertApp('Calcule o cronograma antes de solicitar a análise.');
            return;
        }

        setShowPcpAgent(true);
        setPcpAgentLoading(true);
        setPcpAgentAnalysis(null);
        setPcpAgentError(null);

        // Monta o contexto do cronograma como texto estruturado para o agente
        const dataEntrega = calcDirection === 'backward' ? targetEndDate : targetStartDate;
        const modo = calcDirection === 'backward' ? 'REGRESSIVO (da entrega para trás)' : 'PROGRESSIVO (do início para frente)';
        const diasTipo = daysMode === 'business' ? 'Dias Úteis' : 'Dias Corridos';

        const linhasOp = plannedOps.map((p, i) =>
            `  ${i+1}. [${p.recurso}] ${p.descricao} — Dur: ${p.duracao} ${diasTipo} | Início: ${p.start} | Fim: ${p.end}${p.locked ? ' ⚠️TRAVADO' : ''}`
        ).join('\n');

        const pergunta = `Você é um especialista em PCP (Planejamento e Controle da Produção).

Analise o cronograma de produção abaixo:

**OP:** ${op.op} | **Modo:** ${modo} | **Data âncora:** ${dataEntrega} | **Tipo de dias:** ${diasTipo}

**Sequência de Operações:**
${linhasOp}

**ATENÇÃO: SEJA EXTREMAMENTE SUCINTO, DIRETO E RESUMIDO.**
Forneça apenas:
1. 🔴 **Riscos** — Gargalos ou prazos apertados.
2. 💡 **Recomendações** — Sugestões curtas.
3. ✅ **Veredicto** — Viabilidade (Alta/Média/Baixa).`;

        try {
            const response = await fetch('/api/pcpmetal/ask-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('@MetalFisa:token') || ''}`,
                },
                body: JSON.stringify({
                    pergunta,
                    pedido: op.pedido || op.op,
                    userId: 'pcp-schedule-analyst',
                    historico: [],
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalAnswer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'result') { finalAnswer = data.answer; }
                        if (data.type === 'error') { setPcpAgentError(data.message); }
                    } catch { /* linha incompleta */ }
                }
            }
            if (finalAnswer) setPcpAgentAnalysis(finalAnswer);
            return finalAnswer;
        } catch (err) {
            setPcpAgentError('Erro ao conectar com o agente IA. Verifique a conexão.');
            return null;
        } finally {
            setPcpAgentLoading(false);
        }
    };

    // ── Agente PCP IA: Sequenciamento Ótimo das Operações ────────────────────
    const runPcpAgentSequencing = async () => {
        if (orderedGroups.length === 0) {
            alertApp('Nenhuma operação para sequenciar.');
            return;
        }
        setShowSeqPanel(true);
        setSeqAgentLoading(true);
        setSeqAgentResult(null);
        setSeqAgentError(null);

        const opsList = orderedGroups.map((g, i) => {
            const p = operationPlans[g.code];
            const locked = p?.locked ? ' [CONCLUÍDA - não mover]' : '';
            return `  ${i + 1}. Código: "${g.code}" | Recurso: "${g.desc}"${locked} | Duração: ${p?.duracao ?? '?'} dias`;
        }).join('\n');

        const prompt = `Você é engenheiro especialista em PCP (Planejamento e Controle da Produção) e processos de manufatura metal-mecânica.

Lista atual de operações/recursos desta Ordem de Produção:
${opsList}

TAREFA: Defina a SEQUÊNCIA ÓTIMA dessas operações seguindo a lógica tecnológica de fabricação metal-mecânica:
- Operações de preparação primeiro (guilhotina, corte, laser, puncionamento, estamparia)
- Depois conformação (viradeira, dobramento, cravamento)
- Depois união (solda MIG/TIG, solda ponto/CAP)
- Depois tratamento de superfície (rebarbação, esmerilhamento, acabamento)
- Serviços externos (sufixo -ST) geralmente antes das etapas finais internas
- Por último montagem, pintura, embalagem
- Operações marcadas [CONCLUÍDA - não mover] DEVEM permanecer na posição atual (início da lista)

Responda APENAS com JSON válido neste formato exato (sem texto antes ou depois):
{
  "ordered_codes": ["CODE1", "CODE2", "CODE3"],
  "justification": "Justificativa resumida em 2-3 linhas explicando a lógica aplicada"
}

Os códigos em "ordered_codes" devem ser exatamente iguais aos listados acima.`;

        try {
            const response = await fetch('/api/pcpmetal/ask-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('@MetalFisa:token') || ''}`,
                },
                body: JSON.stringify({
                    pergunta: prompt,
                    pedido: op.pedido || op.op,
                    userId: 'pcp-sequencer',
                    historico: [],
                }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalAnswer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'result') finalAnswer = data.answer;
                        if (data.type === 'error') setSeqAgentError(data.message);
                    } catch { /* linha incompleta */ }
                }
            }

            if (finalAnswer) {
                const jsonMatch = finalAnswer.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const validCodes = new Set(orderedGroups.map(g => g.code));
                    const ordered = (parsed.ordered_codes || []).filter(c => validCodes.has(c));
                    // Garante que nenhum código foi perdido
                    orderedGroups.forEach(g => { if (!ordered.includes(g.code)) ordered.push(g.code); });
                    setSeqAgentResult({ suggestedOrder: ordered, justification: parsed.justification || '' });
                } else {
                    setSeqAgentError('A IA não retornou um JSON válido. Tente novamente.');
                }
            }
        } catch (err) {
            setSeqAgentError(err.message);
        } finally {
            setSeqAgentLoading(false);
        }
    };

    // Aplica a ordem sugerida → reflete imediatamente na lista do modal
    const applySeqAgentOrder = () => {
        if (!seqAgentResult?.suggestedOrder) return;
        const newOrder = seqAgentResult.suggestedOrder
            .map(code => orderedGroups.find(g => g.code === code))
            .filter(Boolean);
        setOrderedGroups(newOrder);
        // Recalcula cascata com nova ordem
        triggerRecalculation(operationPlans, newOrder, calcDirection, includeST, includeSaturday, includeSunday, joinedCodes);
        setShowSeqPanel(false);
        setSeqAgentResult(null);
    };


    const handleConfirmSave = async () => {
        setShowSaveDialog(false);
        setLoading(true);
        try {
            const plansToSave = [];
            Object.entries(operationPlans).forEach(([code, plan]) => {
                // Datas a persistir: as atuais se selecionado, senão a última data conhecida
                // (baseline) — isso permite gravar o checkbox "desmarcado" sem perder o
                // histórico de datas nem violar a obrigatoriedade de data_inicio/data_fim.
                const dataStart = plan.selected ? plan.start : (plan.start || plan.baselineStart);
                const dataEnd   = plan.selected ? plan.end   : (plan.end   || plan.baselineEnd);
                if (!dataStart || !dataEnd) return; // nunca teve data — nada a persistir

                const group = orderedGroups.find(g => g.code === code);
                // Posição do recurso na sequência definida pelo usuário — persistida
                // junto com as datas para não depender de nenhuma preferência auxiliar.
                const ordemRecurso = orderedGroups.findIndex(g => g.code === code);
                if (group) {
                    group.items.forEach(item => {
                        if (!item.operacao) return;
                        // Todos os itens (incluindo concluídos) recebem a nova data calculada do grupo.
                        // Antes, itens concluídos eram pulados aqui — fazendo com que ao reabrir o modal,
                        // as datas antigas do banco fossem carregadas novamente, perdendo o recálculo.
                        plansToSave.push({
                            op_numero:         item.op,
                            op_item:           item.item_op,
                            op_sequencia:      item.sequen,
                            operacao_codigo:   item.operacao,
                            recurso_codigo:    item.recurso         || null,
                            produto_codigo:    item.cod_produto_op  || null,
                            data_inicio: dataStart.includes('T') ? dataStart : `${dataStart} 00:00:00`,
                            data_fim:    dataEnd.includes('T')   ? dataEnd   : `${dataEnd}   23:59:59`,
                            duracao_dias: plan.duracao || null,
                            recurso_code: code,
                            recurso_desc: group.desc || null,
                            ordem_recurso: ordemRecurso >= 0 ? ordemRecurso : null,
                            selecionado: !!plan.selected
                        });
                    });
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

            // Data PCP do Produto Pai (opcional, apenas quando sequen=001)
            const isProdutoPai = op?.sequen === '001';
            const dataPcpOpts = isProdutoPai && saveAtualizarDataPcp ? {
                atualizar_data_pcp:     true,
                data_entrega_pcp_valor: calcDirection === 'backward' ? targetEndDate : targetStartDate,
                pedido_pcp:             op?.pedido_venda || op?.pedido || null,
                item_pcp:               op?.item_op || op?.item || null,
            } : {};

            for (let i = 0; i < chunks.length; i++) {
                await onSaveBatch(chunks[i], saveObservacao, calcDirection, preferencias, dataPcpOpts);
            }

            const now = new Date();
            setLastSavedAt(now);
            setSavedSnapshot(buildSnapshot());

            // Atualiza os baselines para refletir o novo estado salvo no banco.
            // Isso garante que: badge "Salvo" apareça, indicador "Não salvo" suma,
            // e a linha de baseline no Gantt seja reposicionada para as datas atuais.
            setOperationPlans(prev => {
                const next = { ...prev };
                Object.entries(next).forEach(([code, plan]) => {
                    if (plan.start && plan.end) {
                        next[code] = {
                            ...plan,
                            baselineStart: plan.start,
                            baselineEnd: plan.end,
                            isAlreadyPlanned: true,
                        };
                    }
                });
                return next;
            });

            alertApp(`${plansToSave.length} operações salvas com sucesso!`, 'Sucesso');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alertApp(`Erro ao salvar: ${error.message}`, "Erro");
        } finally {
            setLoading(false);
        }
    };

    // ── Auto-Save: salva automaticamente após cada ação do usuário ─────────
    const performAutoSave = useCallback(async () => {
        if (isAutoSavingRef.current) return;
        const anySelected = Object.values(operationPlans).some(p => p.selected && p.start && p.end);
        if (!anySelected) return;

        // Monta o payload idêntico ao handleConfirmSave
        const plansToSave = [];
        Object.entries(operationPlans).forEach(([code, plan]) => {
            const dataStart = plan.selected ? plan.start : (plan.start || plan.baselineStart);
            const dataEnd   = plan.selected ? plan.end   : (plan.end   || plan.baselineEnd);
            if (!dataStart || !dataEnd) return;
            const group = orderedGroups.find(g => g.code === code);
            const ordemRecurso = orderedGroups.findIndex(g => g.code === code);
            if (group) {
                group.items.forEach(item => {
                    if (!item.operacao) return;
                    plansToSave.push({
                        op_numero:       item.op,
                        op_item:         item.item_op,
                        op_sequencia:    item.sequen,
                        operacao_codigo: item.operacao,
                        recurso_codigo:  item.recurso        || null,
                        produto_codigo:  item.cod_produto_op || null,
                        data_inicio: dataStart.includes('T') ? dataStart : `${dataStart} 00:00:00`,
                        data_fim:    dataEnd.includes('T')   ? dataEnd   : `${dataEnd}   23:59:59`,
                        duracao_dias: plan.duracao || null,
                        recurso_code: code,
                        recurso_desc: group.desc || null,
                        ordem_recurso: ordemRecurso >= 0 ? ordemRecurso : null,
                        selecionado: !!plan.selected,
                    });
                });
            }
        });

        if (plansToSave.length === 0) return;
        isAutoSavingRef.current = true;
        setAutoSaveStatus('saving');

        try {
            const CHUNK_SIZE = 100;
            const chunks = [];
            for (let i = 0; i < plansToSave.length; i += CHUNK_SIZE) {
                chunks.push(plansToSave.slice(i, i + CHUNK_SIZE));
            }
            const preferencias = {
                diasModo:      daysMode,
                incluiSabado:  includeSaturday,
                incluiDomingo: includeSunday,
                incluiST:      includeST,
                ordemRecursos: orderedGroups.map(g => g.code),
            };
            for (let i = 0; i < chunks.length; i++) {
                await onSaveBatch(chunks[i], '', calcDirection, preferencias, {});
            }
            const now = new Date();
            setLastSavedAt(now);
            setSavedSnapshot(buildSnapshot());
            setAutoSaveStatus('saved');
            // Sincroniza baselines para refletir o estado recém-salvo
            setOperationPlans(prev => {
                const next = { ...prev };
                Object.entries(next).forEach(([code, plan]) => {
                    if (plan.start && plan.end) {
                        next[code] = { ...plan, baselineStart: plan.start, baselineEnd: plan.end, isAlreadyPlanned: true };
                    }
                });
                return next;
            });
            setTimeout(() => setAutoSaveStatus(s => s === 'saved' ? null : s), 2500);
        } catch (err) {
            console.error('[AUTO-SAVE] Erro ao salvar automaticamente:', err);
            setAutoSaveStatus('error');
            setTimeout(() => setAutoSaveStatus(s => s === 'error' ? null : s), 3500);
        } finally {
            isAutoSavingRef.current = false;
        }
    }, [operationPlans, orderedGroups, daysMode, includeSaturday, includeSunday, includeST, calcDirection, onSaveBatch, buildSnapshot]);

    // Mantém sempre a referência mais recente (evita stale closure dentro do setTimeout)
    performAutoSaveRef.current = performAutoSave;

    const scheduleAutoSave = useCallback(() => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            performAutoSaveRef.current?.();
        }, 1500); // 1,5s de debounce
    }, []); // estável — delega à ref para ter closure atualizado

    // Chave de trigger: muda apenas com dados relevantes, ignora baselineStart/End/isAlreadyPlanned
    // Isso evita que a atualização de baseline (pós-save) re-dispare o auto-save
    const autoSaveTriggerKey = useMemo(() => JSON.stringify({
        snap: Object.entries(operationPlans)
            .filter(([, p]) => p.selected)
            .map(([code, p]) => ({ code, s: p.start, e: p.end, d: p.duracao }))
            .sort((a, b) => a.code.localeCompare(b.code)),
        order:         orderedGroups.map(g => g.code),
        joined:        [...joinedCodes].sort(),
        daysMode,
        includeSaturday,
        includeSunday,
        includeST,
        calcDirection,
    }), [operationPlans, orderedGroups, joinedCodes, daysMode, includeSaturday, includeSunday, includeST, calcDirection]);

    useEffect(() => {
        // Primeira execução após (re)inicialização: registra o estado inicial sem salvar
        if (lastAutoSaveTriggerRef.current === null) {
            lastAutoSaveTriggerRef.current = autoSaveTriggerKey;
            return;
        }
        // Baseline updates (pós-save) não mudam a trigger key — retorna sem ação
        if (autoSaveTriggerKey === lastAutoSaveTriggerRef.current) return;
        lastAutoSaveTriggerRef.current = autoSaveTriggerKey;
        scheduleAutoSave();
    }, [autoSaveTriggerKey, scheduleAutoSave]);

    // Carrega histórico de versões da OP
    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await getPlanningHistory(op.op);
            setHistoryData(data);
        } catch (e) {
            console.error('[HISTORY]', e);
            setHistoryData([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Restaura um lote do histórico como plano atual
    const handleRestoreLote = async (lote) => {
        const ok = await confirmApp({
            title: 'Restaurar Planejamento',
            message: `Restaurar o planejamento do lote ${lote.lote_id}?\nIsso substituirá o plano atual (não salvo ainda).`
        });
        if (!ok) return;
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

    const handlePrint = async () => {
        let aiText = pcpAgentAnalysis;
        const incluir = await confirmApp({
            title: 'Análise PCP IA',
            message: "Deseja inserir a análise do 'Analista PCP IA' neste PDF?\n\n(Caso ainda não tenha gerado, a IA irá gerar um resumo agora antes de imprimir)",
            confirmText: 'Sim, incluir',
            cancelText: 'Não incluir'
        });
        
        if (incluir) {
            if (!aiText) {
                aiText = await runPcpAgentAnalysis();
            }
        } else {
            aiText = null;
        }

        generateGanttPDF(op, orderedGroups, operationPlans, aiText);
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
                                                ? 'cursor-default z-10'
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
                                                                    className={`w-8 bg-transparent text-center font-extrabold text-[12px] outline-none appearance-none border-none shadow-none
                                                                        cursor-text hover:bg-white/20 rounded focus:bg-white/30 focus:ring-1 focus:ring-white/60
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
        <><div className={`fixed inset-0 bg-black/50 flex flex-col items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm animate-in fade-in duration-300 transition-all ${showPcpAgent && pcpAgentPinned ? 'pr-[520px]' : ''}`}>
            <div className={`bg-slate-50 shadow-2xl h-[95vh] flex flex-col overflow-hidden border border-slate-300 rounded-lg transition-all duration-300 ${showPcpAgent && pcpAgentPinned ? 'w-[calc(100vw-540px)]' : 'w-[98vw] max-w-[1200px]'}`}>
                
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

                        {/* Indicador de Auto-Save */}
                        {autoSaveStatus === 'saving' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                            </span>
                        )}
                        {autoSaveStatus === 'saved' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" /> Salvo ✓
                            </span>
                        )}
                        {autoSaveStatus === 'error' && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> Erro ao salvar!
                            </span>
                        )}
                        {/* Durante o debounce (1,5s): avisa que vai salvar em breve */}
                        {hasUnsavedChanges && !autoSaveStatus && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                                <Clock className="w-3 h-3" /> Salvando em breve...
                            </span>
                        )}
                        {lastSavedAt && !hasUnsavedChanges && !autoSaveStatus && (
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
                        {/* Botão Analista PCP IA */}
                        <button
                            onClick={runPcpAgentAnalysis}
                            disabled={pcpAgentLoading || seqAgentLoading}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                showPcpAgent ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                            } disabled:opacity-50`}
                            title="Análise Crítica do Cronograma por IA especialista em PCP"
                        >
                            {pcpAgentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} Analisar IA
                        </button>
                        {/* Botão Sequenciador IA */}
                        <button
                            onClick={runPcpAgentSequencing}
                            disabled={seqAgentLoading || pcpAgentLoading}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                showSeqPanel ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-violet-700 border-violet-200 hover:bg-violet-50'
                            } disabled:opacity-50`}
                            title="IA sugere e aplica a sequência ótima das operações"
                        >
                            {seqAgentLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />} Sequenciar IA
                        </button>
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
                        <button onClick={async () => {
                            if (hasUnsavedChanges) {
                                const ok = await confirmApp({ title: 'Atenção', message: 'Há alterações não salvas. Deseja fechar mesmo assim?' });
                                if (!ok) return;
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
                                    min={todayStr}
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
                                    min={todayStr}
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
                            <Briefcase className="w-3 h-3" /> ÚTEIS
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
                                    savePrefsToDB({ incluiSabado: v });
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
                                    savePrefsToDB({ incluiDomingo: v });
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
                                    savePrefsToDB({ incluiST: v });
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
                                                        {plan.selected && !plan.locked && plan.start && plan.start < todayStr && (
                                                            <span title="Data de início calculada no passado — ajuste a data de entrega ou reduza a duração" className="text-[7px] text-red-600 font-bold bg-red-50 border border-red-200 px-1 py-0.5 rounded leading-none">⚠ Passado</span>
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
                                            <div className="w-24 px-1 py-1 flex items-center justify-center gap-0.5 border-l border-slate-50 bg-slate-50/50">
                                                <button onClick={() => adjustDuration(group.code, -1)} disabled={!plan.selected} className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-0 rounded bg-white border border-slate-100 shadow-sm"><Minus className="w-2.5 h-2.5" /></button>
                                                <input type="text" value={plan.duracao} onChange={e => updateOperationDuration(group.code, e.target.value)} disabled={!plan.selected}
                                                    className="w-6 mx-0.5 bg-transparent text-center text-[11px] font-bold text-slate-700 outline-none" />
                                                <button onClick={() => adjustDuration(group.code, 1)} disabled={!plan.selected} className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-0 rounded bg-white border border-slate-100 shadow-sm"><Plus className="w-2.5 h-2.5" /></button>
                                                <button onClick={() => updateOperationDuration(group.code, 0)} disabled={!plan.selected || Number(plan.duracao) === 0} title="Zerar dias" className="p-0.5 text-slate-400 hover:text-orange-600 disabled:opacity-0 rounded bg-white border border-slate-100 shadow-sm"><RotateCcw className="w-2.5 h-2.5" /></button>
                                            </div>

                                            {/* Calculated Dates Inputs */}
                                            <div className="w-[240px] px-1 py-1 flex items-center justify-center gap-1 border-l border-slate-50">
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
                                                    className={`w-[105px] text-[10px] px-1 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center ${plan.start !== plan.baselineStart ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`} />
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
                                                    className={`w-[105px] text-[10px] px-1 py-0.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center ${plan.end !== plan.baselineEnd ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`} />
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
                        <button onClick={async () => {
                            if (hasUnsavedChanges) {
                                const ok = await confirmApp({ title: 'Atenção', message: 'Há alterações não salvas. Deseja fechar mesmo assim?' });
                                if (!ok) return;
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

                        {/* Opção: Atualizar Data PCP — somente para produto pai (sequen = '001') */}
                        {op?.sequen === '001' && (
                            <div className="mt-1 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={saveAtualizarDataPcp}
                                        onChange={e => setSaveAtualizarDataPcp(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <span className="text-[11px] font-bold text-indigo-800 block">
                                            Atualizar Data PCP do Produto Pai
                                        </span>
                                        <span className="text-[10px] text-indigo-600 block mt-0.5">
                                            Salvar <strong>{(calcDirection === 'backward' ? targetEndDate : targetStartDate)?.split('-').reverse().join('/')}</strong> como <code className="bg-indigo-100 px-1 rounded">data_entrega_pcp</code> do pedido <strong>{op?.pedido_venda || op?.pedido}</strong> / item <strong>{op?.item_op || op?.item}</strong>
                                        </span>
                                    </div>
                                </label>
                            </div>
                        )}

                    </div> {/* fim do bloco de conteúdo do dialog */}

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
                                <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center"><MousePointer className="w-4 h-4 text-indigo-600" /></div>
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

        {/* ── Painel Analista PCP IA ─────────────────────────────────────── */}
        {showPcpAgent && (
            <div
                className={`fixed inset-0 z-[60] flex justify-end ${pcpAgentPinned ? 'pointer-events-none bg-transparent' : 'bg-black/30'}`}
                onClick={() => { if (!pcpAgentPinned) setShowPcpAgent(false); }}
            >
                <div
                    className="bg-white h-full w-full max-w-[520px] shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-indigo-700 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-indigo-200" />
                            <div>
                                <h3 className="text-sm font-bold text-white">Analista PCP IA</h3>
                                <p className="text-[10px] text-indigo-300">Especialista em Planejamento e Controle da Produção</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPcpAgentPinned(p => !p)}
                                title={pcpAgentPinned ? 'Desafixar painel' : 'Fixar painel (mantém aberto e libera interação com a tela)'}
                                className={`p-1 rounded border transition-colors ${pcpAgentPinned ? 'bg-white text-indigo-700 border-white' : 'text-indigo-200 border-indigo-500 hover:bg-indigo-600'}`}
                            >
                                {pcpAgentPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                onClick={runPcpAgentAnalysis}
                                disabled={pcpAgentLoading}
                                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded border border-indigo-500 transition-colors disabled:opacity-50"
                            >
                                {pcpAgentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />} Reanalisar
                            </button>
                            <button onClick={() => setShowPcpAgent(false)} className="text-indigo-200 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {pcpAgentLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
                                <p className="text-sm font-medium text-center">Analisando o cronograma...<br /><span className="text-xs text-slate-400">O agente está revisando sequência, prazos e riscos</span></p>
                            </div>
                        )}
                        {pcpAgentError && !pcpAgentLoading && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{pcpAgentError}</span>
                            </div>
                        )}
                        {pcpAgentAnalysis && !pcpAgentLoading && (
                            <div className="prose prose-sm max-w-none text-slate-700">
                                {pcpAgentAnalysis.split('\n').map((line, i) => {
                                    if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-indigo-800 mt-4 mb-1">{line.replace('## ', '')}</h2>;
                                    if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-indigo-900 mt-4 mb-2">{line.replace('# ', '')}</h1>;
                                    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-slate-700 mt-3 mb-1">{line.replace('### ', '')}</h3>;
                                    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-[13px] my-0.5">{line.replace(/^[-*] /, '').replace(/\*\*(.*?)\*\*/g, '$1')}</li>;
                                    if (/^\d+\./.test(line)) return <p key={i} className="text-[13px] my-1 font-medium">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                                    if (line.trim() === '') return <div key={i} className="my-2" />;
                                    const rendered = line
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                        .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 rounded text-xs font-mono text-indigo-700">$1</code>');
                                    return <p key={i} className="text-[13px] my-1" dangerouslySetInnerHTML={{ __html: rendered }} />;
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 shrink-0">
                        <p className="text-[9px] text-indigo-400 text-center">Análise gerada por IA · Sempre valide com o time de PCP antes de tomar decisões</p>
                    </div>
                </div>
            </div>
        )}

        {/* ── Painel Sequenciador IA ──────────────────────────────────────── */}
        {showSeqPanel && (
            <div className="fixed inset-0 bg-black/40 z-[62] flex justify-end" onClick={() => { setShowSeqPanel(false); setSeqAgentResult(null); }}>
                <div
                    className="bg-white h-full w-full max-w-[460px] shadow-2xl flex flex-col overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-violet-700 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Shuffle className="w-5 h-5 text-violet-200" />
                            <div>
                                <h3 className="text-sm font-bold text-white">Sequenciador IA</h3>
                                <p className="text-[10px] text-violet-300">Ordenação ótima de operações por lógica tecnológica</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={runPcpAgentSequencing}
                                disabled={seqAgentLoading}
                                className="flex items-center gap-1 px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded border border-violet-500 transition-colors disabled:opacity-50"
                            >
                                {seqAgentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />} Regerar
                            </button>
                            <button onClick={() => { setShowSeqPanel(false); setSeqAgentResult(null); }} className="text-violet-200 hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {seqAgentLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                                <Loader2 className="w-10 h-10 animate-spin text-violet-400" />
                                <p className="text-sm font-medium text-center text-slate-600">
                                    Calculando sequência ótima...<br />
                                    <span className="text-xs text-slate-400">O agente está analisando a lógica tecnológica de fabricação</span>
                                </p>
                            </div>
                        )}
                        {seqAgentError && !seqAgentLoading && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{seqAgentError}</span>
                            </div>
                        )}
                        {seqAgentResult && !seqAgentLoading && (
                            <>
                                {/* Justificativa */}
                                {seqAgentResult.justification && (
                                    <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                                        <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1">💡 Lógica aplicada pela IA</p>
                                        <p className="text-[12px] text-violet-800 leading-relaxed">{seqAgentResult.justification}</p>
                                    </div>
                                )}

                                {/* Preview da nova sequência */}
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Nova sequência sugerida</p>
                                    <ol className="space-y-1">
                                        {seqAgentResult.suggestedOrder.map((code, idx) => {
                                            const g = orderedGroups.find(gr => gr.code === code);
                                            const p = operationPlans[code];
                                            const currentIdx = orderedGroups.findIndex(gr => gr.code === code);
                                            const moved = currentIdx !== idx;
                                            return (
                                                <li key={code} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border ${moved ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                                    <span className="font-mono text-[10px] text-slate-500 shrink-0">{code}</span>
                                                    <span className="font-semibold text-slate-700 flex-1 truncate">{g?.desc || code}</span>
                                                    {moved && <span className="text-[9px] text-violet-600 font-bold shrink-0">↕ movido</span>}
                                                    {p?.locked && <span className="text-[9px] text-green-600 font-bold shrink-0">✓ travada</span>}
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer com ação */}
                    {seqAgentResult && !seqAgentLoading && (
                        <div className="px-4 py-3 bg-violet-50 border-t border-violet-200 shrink-0 flex gap-2">
                            <button
                                onClick={() => { setShowSeqPanel(false); setSeqAgentResult(null); }}
                                className="flex-1 px-3 py-2 rounded-lg text-[11px] font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={applySeqAgentOrder}
                                className="flex-1 px-3 py-2 rounded-lg text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-500 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-violet-900/30"
                            >
                                <Shuffle className="w-3.5 h-3.5" /> Aplicar Sequência
                            </button>
                        </div>
                    )}
                    {!seqAgentResult && !seqAgentLoading && (
                        <div className="px-4 py-2 bg-violet-50 border-t border-violet-100 shrink-0">
                            <p className="text-[9px] text-violet-400 text-center">Sugestão gerada por IA · Revise antes de aplicar · Você pode arrastar para ajustar após aplicar</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        </>
    );
}
