import React, { useState, useEffect, useMemo } from 'react';
import { Search, Activity, Calendar, Server, AlertTriangle, Edit2, Save, X, LayoutGrid, AlignLeft, BarChart2, ChevronDown, ChevronRight, Printer, Gauge, Clock, Layers, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import logoMetalfisa from '../../assets/metalfisa-logo.png';

const TaxaOcupacao = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dataInicio, setDataInicio] = useState(() => localStorage.getItem('pcpRefinadoDataInicio') || '');
    const [dataFim, setDataFim] = useState(() => localStorage.getItem('pcpRefinadoDataFim') || '');
    const [recursoBusca, setRecursoBusca] = useState(() => localStorage.getItem('pcpRefinadoRecursoBusca') || '');
    const [error, setError] = useState('');
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [editingOp, setEditingOp] = useState(null); // Agora armazena a rowKey única
    const [editDates, setEditDates] = useState({ inicio: '', fim: '' });
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'heatmap' | 'gantt'
    const [expandedResources, setExpandedResources] = useState({});
    
    // Novas variáveis de estado para OPs do Modal
    const [modalOps, setModalOps] = useState([]);
    const [loadingOps, setLoadingOps] = useState(false);
    const [allRecursos, setAllRecursos] = useState([]);
    
    const getRowKey = (opObj) => {
        return `${opObj.pedido}_${opObj.item_pedido}_${opObj.op}_${opObj.item_op}_${opObj.sequen}_${opObj.produto}_${opObj.operacao}`;
    };
    
    // Filtro Pesado
    const [onlyActive, setOnlyActive] = useState(() => {
        const stored = localStorage.getItem('pcpRefinadoOnlyActive');
        return stored !== 'false';
    });

    useEffect(() => {
        localStorage.setItem('pcpRefinadoOnlyActive', onlyActive);
    }, [onlyActive]);

    useEffect(() => {
        localStorage.setItem('pcpRefinadoDataInicio', dataInicio);
    }, [dataInicio]);

    useEffect(() => {
        localStorage.setItem('pcpRefinadoDataFim', dataFim);
    }, [dataFim]);

    useEffect(() => {
        localStorage.setItem('pcpRefinadoRecursoBusca', recursoBusca);
    }, [recursoBusca]);
    
    // Novos estados do modal (Filtro e Seleção em Massa)
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [selectedOps, setSelectedOps] = useState([]);
    const [bulkDates, setBulkDates] = useState({ inicio: '', fim: '' });
    
    // Estados do Histórico
    const [modalTab, setModalTab] = useState('ops'); // 'ops' | 'historico'
    const [historicoData, setHistoricoData] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const formatLastUpdated = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (dataInicio) params.data_inicio = dataInicio;
            if (dataFim) params.data_fim = dataFim;
            if (recursoBusca) params.recurso = recursoBusca;
            params.only_active = onlyActive ? 'true' : 'false';
            
            const [taxaRes, recursosRes] = await Promise.all([
                api.get('/pcp-refinado/taxa-ocupacao', { params }),
                api.get('/pcp-refinado/recursos').catch(err => {
                    console.warn('Erro ao buscar lista de recursos:', err);
                    return { data: [] };
                })
            ]);

            setData(taxaRes.data || []);
            if (recursosRes.data && recursosRes.data.length > 0) {
                setAllRecursos(recursosRes.data);
            }

            const updatedHeader = taxaRes.headers['x-cache-updated-at'] || taxaRes.headers['X-Cache-Updated-At'];
            if (updatedHeader) {
                setLastUpdated(updatedHeader);
            }

            setError('');
            
            // Se o modal estiver aberto, atualiza os dados dele também
            if (selectedDetail) {
                const currentResource = response.data.find(d => d.data === selectedDetail.data && d.recurso_codigo === selectedDetail.recurso.recurso_codigo);
                if (currentResource) {
                    setSelectedDetail({ data: selectedDetail.data, recurso: currentResource });
                }
            }
        } catch (err) {
            console.error('Erro ao buscar taxa de ocupação:', err);
            setError('Falha ao carregar os dados de ocupação. Verifique sua conexão e tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const fetchModalOps = async () => {
        if (!selectedDetail) return;
        try {
            setLoadingOps(true);
            const params = {
                data: selectedDetail.data,
                recurso: selectedDetail.recurso.recurso_codigo,
                only_active: onlyActive ? 'true' : 'false'
            };
            const response = await api.get('/pcp-refinado/taxa-ocupacao/ops', { params });
            setModalOps(response.data || []);
        } catch (err) {
            console.error('Erro ao buscar detalhamento de OPs:', err);
            alert('Falha ao carregar detalhamento de OPs.');
        } finally {
            setLoadingOps(false);
        }
    };

    useEffect(() => {
        if (selectedDetail) {
            fetchModalOps();
        } else {
            setModalOps([]);
        }
    }, [selectedDetail]);

    const fetchHistorico = async () => {
        try {
            setLoadingHistorico(true);
            const res = await api.get('/pcp-refinado/historico');
            setHistoricoData(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar historico:', err);
        } finally {
            setLoadingHistorico(false);
        }
    };

    useEffect(() => {
        if (selectedDetail && modalTab === 'historico') {
            fetchHistorico();
        }
    }, [selectedDetail, modalTab]);

    const handleSaveDates = async (opObj) => {
        if (editDates.inicio && editDates.fim) {
            if (editDates.fim < editDates.inicio) {
                return alert('A data de fim não pode ser menor que a data de início.');
            }
        }
        try {
            await api.put(`/pcp-refinado/op/${opObj.op}/dates`, {
                data_inicio: editDates.inicio.replace(/-/g, ''),
                data_fim: editDates.fim.replace(/-/g, ''),
                operacao_codigo: opObj.operacao,
                item_op: opObj.item_op,
                sequen: opObj.sequen,
                pedido: opObj.pedido,
                item_pedido: opObj.item_pedido,
                produto: opObj.produto
            });

            // Otimistic UI Update: atualiza a data visualmente na hora!
            setModalOps(prev => {
                return prev.map(o => {
                    if (o.op === opObj.op && o.operacao === opObj.operacao && o.item_op === opObj.item_op && o.sequen === opObj.sequen) {
                        return {
                            ...o,
                            data_planejada: editDates.inicio.replace(/-/g, ''),
                            data_planejada_final: editDates.fim.replace(/-/g, '')
                        };
                    }
                    return o;
                });
            });

            setEditingOp(null);
            
            // Recarrega em background sem piscar a tela agressivamente
            fetchData();
            fetchModalOps();
            if (modalTab === 'historico') fetchHistorico();
        } catch (err) {
            alert('Erro ao salvar datas: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleBulkSave = async () => {
        if (selectedOps.length === 0) return alert('Selecione ao menos uma OP.');
        if (!bulkDates.inicio && !bulkDates.fim) return alert('Preencha ao menos uma data para aplicar.');
        if (bulkDates.inicio && bulkDates.fim) {
            if (bulkDates.fim < bulkDates.inicio) {
                return alert('A data de fim não pode ser menor que a data de início.');
            }
        }
        
        try {
            // Localiza as operacoes completas para enviar o codigo correto
            const opsToUpdate = selectedOps.map(rowKey => {
                return modalOps.find(o => getRowKey(o) === rowKey) || null;
            }).filter(Boolean);

            await Promise.all(opsToUpdate.map(opObj => 
                api.put(`/pcp-refinado/op/${opObj.op}/dates`, {
                    data_inicio: bulkDates.inicio.replace(/-/g, ''),
                    data_fim: bulkDates.fim.replace(/-/g, ''),
                    operacao_codigo: opObj.operacao,
                    item_op: opObj.item_op,
                    sequen: opObj.sequen,
                    pedido: opObj.pedido,
                    item_pedido: opObj.item_pedido,
                    produto: opObj.produto
                })
            ));
            
            setSelectedOps([]);
            setBulkDates({ inicio: '', fim: '' });
            fetchData();
            fetchModalOps();
            if (modalTab === 'historico') fetchHistorico();
        } catch (err) {
            alert('Erro ao aplicar datas em lote: ' + (err.response?.data?.error || err.message));
        }
    };

    const getOccupationColor = (percent) => {
        if (percent >= 100) return 'bg-red-500 text-white';
        if (percent >= 80) return 'bg-yellow-500 text-white';
        return 'bg-emerald-500 text-white';
    };

    const getProgressColor = (percent) => {
        if (percent >= 100) return 'bg-red-500';
        if (percent >= 80) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    // Group by Date to make it easier to read
    const groupedByDate = data.reduce((acc, curr) => {
        if (!acc[curr.data]) {
            acc[curr.data] = [];
        }
        acc[curr.data].push(curr);
        return acc;
    }, {});

    // Preenche dias vazios se houver intervalo definido
    if (dataInicio && dataFim) {
        try {
            // Usa UTC para evitar problemas de fuso horário
            const start = new Date(dataInicio + 'T00:00:00Z');
            const end = new Date(dataFim + 'T00:00:00Z');
            
            // Limite de sanidade: máximo de 365 dias
            if (start <= end && (end - start) / (1000 * 60 * 60 * 24) <= 365) {
                let current = new Date(start);
                while (current <= end) {
                    const y = current.getUTCFullYear();
                    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
                    const d = String(current.getUTCDate()).padStart(2, '0');
                    // Formato YYYY-MM-DD para bater com o que o backend retorna em curr.data
                    const dateStr = `${y}-${m}-${d}`;

                    if (!groupedByDate[dateStr]) {
                        groupedByDate[dateStr] = [];
                    }
                    current.setUTCDate(current.getUTCDate() + 1);
                }
            }
        } catch (e) {
            console.error("Erro ao preencher datas vazias", e);
        }
    }

    // Ordenar as chaves (datas) para exibição cronológica
    const sortedDates = Object.keys(groupedByDate).sort();

    const formatDateBR = (val) => {
        if (!val) return '-';
        if (val.length === 10 && val.includes('-')) {
            const [y, m, d] = val.split('-');
            return `${d}/${m}/${y}`;
        }
        if (val.length === 8 && !val.includes('-')) {
            return `${val.substring(6,8)}/${val.substring(4,6)}/${val.substring(0,4)}`;
        }
        return val;
    };

    const renderOpBadge = (opStr) => {
        if (!opStr) return '-';
        const match = String(opStr).trim().match(/^([0-9]{6,11})[- ]?([A-Za-z]{2})$/);
        if (match) {
            return (
                <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-semibold text-slate-800">{match[1]}</span>
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[11px] border border-indigo-200 tracking-wider shadow-sm">
                        {match[2].toUpperCase()}
                    </span>
                </div>
            );
        }
        return <span className="font-semibold text-slate-800 font-mono">{opStr}</span>;
    };

    const periodStats = useMemo(() => {
        // 1. Recursos a considerar (respeitando busca de recurso)
        const searchLower = (recursoBusca || '').trim().toLowerCase();
        let activeRecursos = (allRecursos || []).filter(r => {
            if (!searchLower) return true;
            const cod = (r.cod_recurso || '').toLowerCase();
            const desc = (r.desc_recurso || '').toLowerCase();
            return cod.includes(searchLower) || desc.includes(searchLower);
        });

        // Fallback: se allRecursos ainda não carregou, extrai do data
        if (activeRecursos.length === 0) {
            const map = {};
            (data || []).forEach(item => {
                if (item.recurso_codigo && !map[item.recurso_codigo]) {
                    map[item.recurso_codigo] = {
                        cod_recurso: item.recurso_codigo,
                        desc_recurso: item.recurso_descri,
                        capacidade_diaria_minutos: Number(item.capacidade_diaria) || 480
                    };
                }
            });
            activeRecursos = Object.values(map);
        }

        // 2. Determinar início e fim do período filtrado
        let startStr = dataInicio;
        let endStr = dataFim;
        if (!startStr || !endStr) {
            if (sortedDates.length > 0) {
                startStr = startStr || sortedDates[0];
                endStr = endStr || sortedDates[sortedDates.length - 1];
            } else {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                startStr = `${y}-${m}-01`;
                endStr = `${y}-${m}-${d}`;
            }
        }

        // 3. Contabilizar dias úteis no período
        const weekendWorkDates = new Set((data || []).filter(item => {
            const dt = new Date(`${item.data}T00:00:00Z`);
            const day = dt.getUTCDay();
            return (day === 0 || day === 6) && Number(item.minutos_consumidos) > 0;
        }).map(item => item.data));

        const periodDaysList = [];
        const workingDaysList = [];
        try {
            const start = new Date(startStr + 'T00:00:00Z');
            const end = new Date(endStr + 'T00:00:00Z');
            if (start <= end && (end - start) / (1000 * 60 * 60 * 24) <= 365) {
                let cur = new Date(start);
                while (cur <= end) {
                    const y = cur.getUTCFullYear();
                    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
                    const d = String(cur.getUTCDate()).padStart(2, '0');
                    const dStr = `${y}-${m}-${d}`;
                    periodDaysList.push(dStr);
                    const dayOfWeek = cur.getUTCDay();
                    if ((dayOfWeek !== 0 && dayOfWeek !== 6) || weekendWorkDates.has(dStr)) {
                        workingDaysList.push(dStr);
                    }
                    cur.setUTCDate(cur.getUTCDate() + 1);
                }
            }
        } catch (e) {
            console.error('Erro calculando dias úteis:', e);
        }

        const numDiasTotais = periodDaysList.length || (sortedDates.length || 1);
        const numDiasUteis = workingDaysList.length || numDiasTotais;

        // 4. Capacidade total do período
        let totalCapacidadeMinutos = 0;
        const resCapMap = {};
        activeRecursos.forEach(r => {
            const capDiaria = Number(r.capacidade_diaria_minutos) > 0 ? Number(r.capacidade_diaria_minutos) : 480;
            const resPeriodCapMin = capDiaria * numDiasUteis;
            totalCapacidadeMinutos += resPeriodCapMin;
            resCapMap[r.cod_recurso] = {
                capDiaria,
                resPeriodCapMin,
                resPeriodCapHoras: (resPeriodCapMin / 60).toFixed(1)
            };
        });

        // 5. Cargas consumidas e executadas
        let totalMinutosConsumidos = 0;
        let totalMinutosExecutados = 0;
        let totalMinutosPendentes = 0;
        const resDemandMap = {};

        (data || []).forEach(item => {
            const cons = Number(item.minutos_consumidos) || 0;
            const exec = Number(item.minutos_executados) || 0;
            const pend = Number(item.minutos_pendentes) || 0;

            totalMinutosConsumidos += cons;
            totalMinutosExecutados += exec;
            totalMinutosPendentes  += pend;

            if (item.recurso_codigo) {
                if (!resDemandMap[item.recurso_codigo]) {
                    resDemandMap[item.recurso_codigo] = { cons: 0, exec: 0, pend: 0 };
                }
                resDemandMap[item.recurso_codigo].cons += cons;
                resDemandMap[item.recurso_codigo].exec += exec;
                resDemandMap[item.recurso_codigo].pend += pend;
            }
        });

        const taxaOcupacaoGeral = totalCapacidadeMinutos > 0
            ? (totalMinutosConsumidos / totalCapacidadeMinutos) * 100
            : 0;

        const taxaExecutadoGeral = totalCapacidadeMinutos > 0
            ? (totalMinutosExecutados / totalCapacidadeMinutos) * 100
            : 0;

        const saldoCapacidadeMinutos = totalCapacidadeMinutos - totalMinutosConsumidos;

        const getResPeriodInfo = (resCode, fallbackCapDiaria = 480) => {
            const capInfo = resCapMap[resCode] || {
                capDiaria: fallbackCapDiaria,
                resPeriodCapMin: fallbackCapDiaria * numDiasUteis,
                resPeriodCapHoras: ((fallbackCapDiaria * numDiasUteis) / 60).toFixed(1)
            };
            const demInfo = resDemandMap[resCode] || { cons: 0, exec: 0, pend: 0 };
            const taxa = capInfo.resPeriodCapMin > 0 ? (demInfo.cons / capInfo.resPeriodCapMin) * 100 : 0;
            return {
                capDiaria: capInfo.capDiaria,
                periodCapMin: capInfo.resPeriodCapMin,
                periodCapHoras: capInfo.resPeriodCapHoras,
                periodConsMin: demInfo.cons,
                periodConsHoras: (demInfo.cons / 60).toFixed(1),
                periodExecMin: demInfo.exec,
                periodTaxa: taxa
            };
        };

        return {
            startStr,
            endStr,
            numDiasTotais,
            numDiasUteis,
            numRecursos: activeRecursos.length,
            totalCapacidadeMinutos,
            totalCapacidadeHoras: (totalCapacidadeMinutos / 60).toFixed(1),
            totalMinutosConsumidos,
            totalHorasConsumidas: (totalMinutosConsumidos / 60).toFixed(1),
            totalMinutosExecutados,
            totalHorasExecutadas: (totalMinutosExecutados / 60).toFixed(1),
            totalMinutosPendentes,
            totalHorasPendentes: (totalMinutosPendentes / 60).toFixed(1),
            saldoCapacidadeMinutos,
            saldoCapacidadeHoras: (Math.abs(saldoCapacidadeMinutos) / 60).toFixed(1),
            isOverCapacity: saldoCapacidadeMinutos < 0,
            taxaOcupacaoGeral,
            taxaExecutadoGeral,
            activeRecursos,
            getResPeriodInfo
        };
    }, [data, allRecursos, dataInicio, dataFim, recursoBusca, sortedDates]);

    return (
        <div className="w-full max-w-[1920px] mx-auto relative h-full flex flex-col">
            {/* HEADER FIXO */}
            <div className="sticky top-0 z-30 bg-slate-50 p-6 pb-4 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Taxa de Ocupação Diária
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <p className="text-slate-500 text-sm">
                            Análise de carga vs capacidade dos recursos (CRP).
                        </p>
                        {lastUpdated && (
                            <>
                                <span className="text-slate-300 hidden md:inline">•</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                    Atualizado em: {formatLastUpdated(lastUpdated)}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                        />
                        <span className="text-slate-400">até</span>
                        <input
                            type="date"
                            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            value={dataFim}
                            onChange={(e) => setDataFim(e.target.value)}
                        />
                    </div>
                    
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar recurso..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={recursoBusca}
                            onChange={(e) => setRecursoBusca(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                        />
                    </div>
                    
                    <div className="flex items-center border border-slate-200 rounded-lg px-3 bg-slate-50" title="Desative para incluir pedidos já entregues / faturados.">
                        <label className="relative inline-flex items-center cursor-pointer py-2">
                            <input
                                type="checkbox"
                                checked={onlyActive}
                                onChange={(e) => {
                                    setOnlyActive(e.target.checked);
                                }}
                                className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
                            <span className="ml-2 text-xs font-medium text-slate-700 whitespace-nowrap hidden sm:block">
                                Apenas Pendentes (Filtro Pesado)
                            </span>
                            <span className="ml-2 text-xs font-medium text-slate-700 whitespace-nowrap sm:hidden">
                                Pendentes
                            </span>
                        </label>
                    </div>

                    <button 
                        onClick={fetchData}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        Filtrar
                    </button>
                </div>
            </div>

            {/* BANNER DE CAPACIDADE DO PERÍODO FILTRADO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Capacidade do Período */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                                Capacidade do Período
                            </span>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                                {periodStats.numDiasUteis} dias úteis
                            </span>
                        </div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">
                            {periodStats.totalCapacidadeHoras} <span className="text-sm font-semibold text-slate-500">horas</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            {periodStats.totalCapacidadeMinutos.toLocaleString('pt-BR')} min ({periodStats.numRecursos} recursos configurados)
                        </div>
                        <div className="text-[11px] text-blue-600 font-medium mt-1">
                            📅 {formatDateBR(periodStats.startStr)} até {formatDateBR(periodStats.endStr)}
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                        <Gauge className="w-6 h-6" />
                    </div>
                </div>

                {/* Card 2: Carga Planejada (Demanda) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                            Carga Planejada (Demanda)
                        </span>
                        <div className="text-2xl font-bold text-blue-700 mt-1">
                            {periodStats.totalHorasConsumidas} <span className="text-sm font-semibold text-blue-500">horas</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span>{periodStats.totalMinutosConsumidos.toLocaleString('pt-BR')} min</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getOccupationColor(periodStats.taxaOcupacaoGeral)}`}>
                                {periodStats.taxaOcupacaoGeral.toFixed(1)}% da capacidade
                            </span>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>

                {/* Card 3: Saldo / Margem de Capacidade */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                            {periodStats.isOverCapacity ? 'Sobrecarga no Período' : 'Capacidade Disponível'}
                        </span>
                        <div className={`text-2xl font-bold mt-1 ${periodStats.isOverCapacity ? 'text-red-600' : 'text-emerald-600'}`}>
                            {periodStats.isOverCapacity ? `+${periodStats.saldoCapacidadeHoras}` : periodStats.saldoCapacidadeHoras}{' '}
                            <span className="text-sm font-semibold text-slate-500">horas</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            {periodStats.isOverCapacity ? (
                                <span className="text-red-600 font-semibold">Gargalo: excede capacidade</span>
                            ) : (
                                <span className="text-emerald-700 font-medium">Margem livre para programar</span>
                            )}
                        </div>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${periodStats.isOverCapacity ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        <Layers className="w-6 h-6" />
                    </div>
                </div>

                {/* Card 4: Produção Executada */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                            Produção Executada
                        </span>
                        <div className="text-2xl font-bold text-slate-800 mt-1">
                            {periodStats.totalHorasExecutadas} <span className="text-sm font-semibold text-slate-500">horas</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            {periodStats.totalMinutosExecutados.toLocaleString('pt-BR')} min ({periodStats.taxaExecutadoGeral.toFixed(1)}% da capacidade)
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 shadow-sm border border-slate-200">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* View Mode Tabs */}
            <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1 w-fit">
                <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <AlignLeft className="w-4 h-4" /> Tabela (Detalhado)
                </button>
                <button
                    onClick={() => setViewMode('heatmap')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'heatmap' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> Mapa de Calor
                </button>
                <button
                    onClick={() => setViewMode('gantt')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'gantt' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <BarChart2 className="w-4 h-4" /> Gráfico
                </button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <button
                    onClick={() => {
                        import('../../services/taxaOcupacaoPdfGenerator').then(m => {
                            m.generateTaxaOcupacaoPdf(viewMode, data);
                        });
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 transition-colors shadow-sm"
                    title="Imprimir relatório da aba atual (A4 Deitado)"
                >
                    <Printer className="w-4 h-4" /> Imprimir
                </button>
            </div>

            </div>

            {/* CONTEÚDO */}
            <div className="px-6 pb-6 space-y-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-500 font-medium animate-pulse">Calculando demanda global...</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                    {sortedDates.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                                <Gauge className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">
                                Capacidade Disponível no Período Filtrado: {periodStats.totalCapacidadeHoras} horas
                            </h3>
                            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                                Período de {formatDateBR(periodStats.startStr)} até {formatDateBR(periodStats.endStr)} ({periodStats.numDiasUteis} dias úteis • {periodStats.numRecursos} recursos configurados).
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                                Nenhuma ordem de produção programada para este período. Capacidade 100% livre para novas programações.
                            </p>
                        </div>
                    ) : (
                        <>
                            {viewMode === 'table' && (
                                <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
                                            <Gauge className="w-5 h-5 text-blue-300" />
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase font-semibold tracking-wider text-blue-200 flex items-center gap-2">
                                                <span>Marcação da Capacidade do Período Filtrado</span>
                                                <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-100 text-[10px] font-mono border border-blue-400/30">
                                                    {formatDateBR(periodStats.startStr)} a {formatDateBR(periodStats.endStr)}
                                                </span>
                                            </div>
                                            <div className="text-base md:text-lg font-bold flex flex-wrap items-center gap-2 mt-0.5">
                                                <span>Capacidade Total: {periodStats.totalCapacidadeHoras}h ({periodStats.totalCapacidadeMinutos.toLocaleString('pt-BR')} min)</span>
                                                <span className="text-xs font-normal text-slate-300">• {periodStats.numDiasUteis} dias úteis • {periodStats.numRecursos} recurso(s)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur border border-white/10 font-medium">
                                            Demanda Total: <strong className="text-white">{periodStats.totalHorasConsumidas}h</strong>
                                        </span>
                                        <span className={`px-3 py-1.5 rounded-lg font-bold shadow-sm ${getOccupationColor(periodStats.taxaOcupacaoGeral)}`}>
                                            Ocupação Global: {periodStats.taxaOcupacaoGeral.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            {viewMode === 'table' && sortedDates.map(dateStr => {
                                const diaItens = groupedByDate[dateStr] || [];
                                const diaCapacidade = diaItens.reduce((acc, c) => acc + (Number(c.capacidade_diaria) || 0), 0);
                                const diaCapacidadeHoras = (diaCapacidade / 60).toFixed(1);
                                const diaConsumidos = diaItens.reduce((acc, c) => acc + (Number(c.minutos_consumidos) || 0), 0);
                                const diaConsumidosHoras = (diaConsumidos / 60).toFixed(1);
                                const diaPendentes = diaItens.reduce((acc, c) => acc + (Number(c.minutos_pendentes) || 0), 0);
                                const diaTaxa = diaCapacidade > 0 ? (diaConsumidos / diaCapacidade) * 100 : 0;

                                return (
                                <div key={dateStr} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 border-b border-slate-100 py-3 px-6 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                        <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-slate-400" />
                                            Data Início (Planejada): {formatDateBR(dateStr)}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-medium text-slate-700 shadow-sm flex items-center gap-1.5">
                                                <Gauge className="w-3.5 h-3.5 text-blue-600" />
                                                Capacidade do Dia: <strong className="text-slate-900">{diaCapacidade.toLocaleString('pt-BR')} min ({diaCapacidadeHoras}h)</strong>
                                            </span>
                                            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md font-medium text-blue-800 shadow-sm flex items-center gap-1.5" title="Marcação da capacidade total no período filtrado">
                                                <Layers className="w-3.5 h-3.5 text-blue-600" />
                                                Marcação Período: <strong>{periodStats.totalCapacidadeHoras}h ({periodStats.numDiasUteis}d)</strong>
                                            </span>
                                            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-medium text-slate-700 shadow-sm flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                                Demanda Dia: <strong className="text-blue-700">{diaConsumidos.toLocaleString('pt-BR')} min ({diaConsumidosHoras}h)</strong>
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-md font-bold text-white shadow-sm ${getOccupationColor(diaTaxa)}`}>
                                                Ocupação Dia: {diaTaxa.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-slate-600">
                                                <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-4 font-semibold w-1/3">Recurso / C.T.</th>
                                                        <th className="px-6 py-4 font-semibold text-center w-40">Capacidade</th>
                                                        <th className="px-6 py-4 font-semibold text-center w-36" title="Total planejado para o dia e período">Demanda</th>
                                                        <th className="px-6 py-4 font-semibold text-center w-32" title="Ainda não produzido">Pendente (Min)</th>
                                                        <th className="px-6 py-4 font-semibold w-1/3">Ocupação</th>
                                                        <th className="px-6 py-4 font-semibold text-right">Ação</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {diaItens.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                                                                Nenhuma carga programada para iniciar neste dia.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        diaItens.map(item => {
                                                        const resInfo = periodStats.getResPeriodInfo(item.recurso_codigo, item.capacidade_diaria);
                                                        const isOverloaded = item.taxa_ocupacao > 100;
                                                        const displayPercent = item.taxa_ocupacao > 999 ? '> 999' : item.taxa_ocupacao.toFixed(1);
                                                        const barWidth = Math.min(item.taxa_ocupacao, 100);

                                                        return (
                                                            <tr key={item.recurso_codigo} className={`hover:bg-slate-50 transition-colors ${isOverloaded ? 'bg-red-50/30' : ''}`}>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-medium text-slate-800">{item.recurso_descri}</div>
                                                                    <div className="text-xs text-slate-400 mt-0.5">Cod: {item.recurso_codigo}</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center font-medium">
                                                                    {item.capacidade_diaria > 0 ? (
                                                                        <div>
                                                                            <span className="text-slate-800 font-semibold">{item.capacidade_diaria.toLocaleString('pt-BR')} min</span>
                                                                            <div className="text-[11px] text-slate-500">({(item.capacidade_diaria / 60).toFixed(1)}h/dia)</div>
                                                                            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100 text-[10px] font-semibold" title="Capacidade total deste recurso no período filtrado">
                                                                                <Gauge className="w-3 h-3 text-blue-600" />
                                                                                Período: {resInfo.periodCapHoras}h
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-red-400 text-xs">Não Config.</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-center font-medium">
                                                                    <div className="text-slate-800 font-semibold">{(item.minutos_consumidos || 0).toLocaleString('pt-BR')} min</div>
                                                                    <div className="text-[11px] text-slate-400">({((item.minutos_consumidos || 0) / 60).toFixed(1)}h no dia)</div>
                                                                    <div className="text-[10px] text-slate-500 mt-0.5 font-normal">Período: {resInfo.periodConsHoras}h</div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center font-medium">
                                                                    <span className={(item.minutos_pendentes || 0) > 0 ? 'text-amber-700' : 'text-emerald-600'}>
                                                                        {(item.minutos_pendentes || 0).toLocaleString('pt-BR')}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col gap-2">
                                                                        {/* CARGA PENDENTE */}
                                                                        <div className="flex items-center justify-between mt-1">
                                                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getOccupationColor(item.taxa_ocupacao)} shadow-sm`}>
                                                                                Carga Dia: {displayPercent}%
                                                                            </span>
                                                                            <span className="text-[11px] text-slate-500 font-medium">
                                                                                Período: <strong className={resInfo.periodTaxa > 100 ? 'text-red-600' : 'text-slate-700'}>{resInfo.periodTaxa.toFixed(1)}%</strong>
                                                                            </span>
                                                                            {isOverloaded && (
                                                                                <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Gargalo</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="relative w-full bg-slate-100 rounded-full h-2 shadow-inner overflow-visible mb-2">
                                                                            <div 
                                                                                className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(item.taxa_ocupacao)}`}
                                                                                style={{ width: `${barWidth}%` }}
                                                                            />
                                                                            {/* Marcação de 100% da Capacidade */}
                                                                            <div 
                                                                                className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-slate-800 z-10" 
                                                                                style={{ left: '100%' }}
                                                                                title="Marcação de 100% da Capacidade"
                                                                            />
                                                                        </div>

                                                                        {/* EXECUTADO */}
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                                                                                Executado: {item.percentual_executado ? item.percentual_executado.toFixed(1) : 0}%
                                                                            </span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 rounded-full h-1.5 shadow-inner overflow-hidden">
                                                                            <div 
                                                                                className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                                                                                style={{ width: `${Math.min(item.percentual_executado || 0, 100)}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <button 
                                                                        onClick={() => setSelectedDetail({ data: dateStr, recurso: item })}
                                                                        className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded transition-colors"
                                                                    >
                                                                        Detalhar OPs
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                    )}
                                                </tbody>
                                                {diaItens.length > 0 && (
                                                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-700">
                                                        <tr>
                                                            <td className="px-6 py-3 text-slate-800 uppercase tracking-wider">TOTAL DO DIA ({diaItens.length} recursos)</td>
                                                            <td className="px-6 py-3 text-center text-slate-900 font-bold">
                                                                {diaCapacidade.toLocaleString('pt-BR')} min
                                                                <div className="text-[10px] text-slate-400 font-normal">({diaCapacidadeHoras}h)</div>
                                                            </td>
                                                            <td className="px-6 py-3 text-center text-blue-700 font-bold">
                                                                {diaConsumidos.toLocaleString('pt-BR')} min
                                                                <div className="text-[10px] text-blue-500 font-normal">({diaConsumidosHoras}h)</div>
                                                            </td>
                                                            <td className="px-6 py-3 text-center text-amber-700 font-bold">
                                                                {diaPendentes.toLocaleString('pt-BR')} min
                                                            </td>
                                                            <td className="px-6 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-sm ${getOccupationColor(diaTaxa)}`}>
                                                                        {diaTaxa.toFixed(1)}%
                                                                    </span>
                                                                    <span className="text-[11px] text-slate-500 font-normal">
                                                                        {diaConsumidos > diaCapacidade ? `Excede em ${(diaConsumidos - diaCapacidade).toLocaleString('pt-BR')} min` : `Livre ${(diaCapacidade - diaConsumidos).toLocaleString('pt-BR')} min`}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}

                            {viewMode === 'heatmap' && (() => {
                                // For Heatmap, ensure we have a continuous range of dates
                                let allDates = [];
                                if (sortedDates.length > 0) {
                                    // sortedDates já estão em YYYY-MM-DD (mesmo formato do backend)
                                    const minStr = sortedDates[0];
                                    const maxStr = sortedDates[sortedDates.length - 1];
                                    const start = new Date(`${minStr}T00:00:00Z`);
                                    const end   = new Date(`${maxStr}T00:00:00Z`);

                                    if (start <= end && (end - start) / (1000 * 60 * 60 * 24) <= 365) {
                                        let current = new Date(start);
                                        while (current <= end) {
                                            const y = current.getUTCFullYear();
                                            const m = String(current.getUTCMonth() + 1).padStart(2, '0');
                                            const d = String(current.getUTCDate()).padStart(2, '0');
                                            allDates.push(`${y}-${m}-${d}`); // YYYY-MM-DD — bate com item.data
                                            current.setUTCDate(current.getUTCDate() + 1);
                                        }
                                    } else {
                                        allDates = [...sortedDates];
                                    }
                                }

                                const allResourcesMap = {};
                                // Garantir que todos os recursos configurados apareçam
                                (periodStats.activeRecursos || []).forEach(r => {
                                    allResourcesMap[r.cod_recurso] = {
                                        descri: r.desc_recurso || r.cod_recurso,
                                        loadByDate: {},
                                        capacidade_diaria: Number(r.capacidade_diaria_minutos) || 480
                                    };
                                });

                                Object.values(groupedByDate).forEach(arr => {
                                    arr.forEach(item => {
                                        if (!allResourcesMap[item.recurso_codigo]) {
                                            allResourcesMap[item.recurso_codigo] = { descri: item.recurso_descri, loadByDate: {}, capacidade_diaria: Number(item.capacidade_diaria) || 480 };
                                        }
                                        allResourcesMap[item.recurso_codigo].loadByDate[item.data] = item;
                                    });
                                });
                                const allResources = Object.keys(allResourcesMap).sort((a,b) => (allResourcesMap[a].descri || '').localeCompare(allResourcesMap[b].descri || ''));

                                const isWeekend = (dateStr) => {
                                    const dt = new Date(`${dateStr}T00:00:00Z`);
                                    const day = dt.getUTCDay();
                                    return day === 0 || day === 6; // Sunday or Saturday
                                };

                                return (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto max-h-[70vh]">
                                        <table className="w-full text-sm text-left relative">
                                            <thead className="bg-slate-50 border-b sticky top-0 z-20 shadow-sm">
                                                <tr>
                                                    <th className="p-3 font-bold text-slate-700 min-w-[220px] sticky left-0 top-0 bg-slate-50 z-30 border-r shadow-[1px_0_0_0_rgba(226,232,240,1)]">Recurso / Máquina</th>
                                                    {allDates.map(d => {
                                                        const colItems = (data || []).filter(item => item.data === d);
                                                        const colCapMin = colItems.reduce((acc, c) => acc + (Number(c.capacidade_diaria) || 0), 0);
                                                        const colCapHoras = (colCapMin / 60).toFixed(0);

                                                        return (
                                                        <th key={d} className={`p-2.5 font-semibold text-center min-w-[105px] ${isWeekend(d) ? 'bg-orange-50 text-orange-700' : 'text-slate-600'}`}>
                                                            <div className="font-bold">{formatDateBR(d).substring(0, 5)}</div>
                                                            {isWeekend(d) ? (
                                                                <div className="text-[10px] opacity-75 font-normal">Fim de Semana</div>
                                                            ) : (
                                                                <div className="text-[10px] text-blue-600 font-medium">Cap: {colCapHoras}h</div>
                                                            )}
                                                        </th>
                                                        );
                                                    })}
                                                    {/* Colunas de Resumo da Marcação do Período */}
                                                    <th className="p-2.5 font-bold text-center bg-blue-50 text-blue-900 border-l-2 border-blue-200 min-w-[110px]" title="Marcação da Capacidade Total no Período Filtrado">
                                                        Cap. Período
                                                    </th>
                                                    <th className="p-2.5 font-bold text-center bg-slate-100 text-slate-800 min-w-[110px]" title="Demanda Total no Período Filtrado">
                                                        Demanda Total
                                                    </th>
                                                    <th className="p-2.5 font-bold text-center bg-slate-100 text-slate-800 min-w-[110px]" title="Taxa de Ocupação no Período Filtrado">
                                                        Ocupação Período
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {allResources.map(resCode => {
                                                    const res = allResourcesMap[resCode];
                                                    const resCapDiaria = res.capacidade_diaria || 480;
                                                    const resInfo = periodStats.getResPeriodInfo(resCode, resCapDiaria);

                                                    return (
                                                        <tr key={resCode} className="hover:bg-slate-50">
                                                            <td className="p-3 font-medium text-slate-800 sticky left-0 bg-white border-r shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                                                                <div className="truncate w-48 font-semibold text-slate-800" title={res.descri}>{res.descri}</div>
                                                                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                                                                    <span>{resCode}</span>
                                                                    <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title="Capacidade diária e do período">
                                                                        Cap: {Math.round(resCapDiaria)}m/d ({resInfo.periodCapHoras}h período)
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            {allDates.map(d => {
                                                                const item = res.loadByDate[d];
                                                                if (!item) return <td key={d} className="p-3 text-center text-slate-300">-</td>;
                                                                
                                                                const percent = item.taxa_ocupacao;
                                                                let colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
                                                                if (percent >= 100) colorClass = 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 font-bold';
                                                                else if (percent >= 80) colorClass = 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';

                                                                return (
                                                                    <td key={d} className="p-1.5 text-center align-middle">
                                                                        <button 
                                                                            onClick={() => setSelectedDetail({ data: d, recurso: item })}
                                                                            className={`w-full py-2 px-1.5 rounded border shadow-sm transition-all text-xs flex flex-col items-center justify-center gap-1 ${colorClass}`}
                                                                            title={`Capacidade: ${Math.round(item.capacidade_diaria)}m | Consumo: ${Math.round(item.minutos_consumidos)}m | Executado: ${Math.round(item.minutos_executados || 0)}m`}
                                                                        >
                                                                            <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                                                                                <div className="flex items-center gap-0.5">
                                                                                    <span className="text-[9px] opacity-75 font-normal">Pl:</span>
                                                                                    <span className="font-bold">{percent.toFixed(0)}%</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-0.5 text-[9px] text-blue-700 font-semibold bg-blue-50/50 px-1 rounded">
                                                                                    <span>Ex:</span>
                                                                                    <span>{(item.percentual_executado || 0).toFixed(0)}%</span>
                                                                                </div>
                                                                            </div>
                                                                            {item.minutos_consumidos > 0 && (
                                                                                <span className="text-[9px] opacity-75 border-t border-current/10 pt-0.5 w-full block text-center font-medium">
                                                                                    {Math.round(item.minutos_consumidos)}m / {Math.round(item.capacidade_diaria)}m
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                            {/* Células de Resumo da Marcação do Período */}
                                                            <td className="p-2 text-center align-middle font-bold text-blue-900 bg-blue-50/50 border-l-2 border-blue-200 text-xs">
                                                                {resInfo.periodCapHoras}h
                                                                <div className="text-[10px] text-blue-600 font-normal">({periodStats.numDiasUteis}d úteis)</div>
                                                            </td>
                                                            <td className="p-2 text-center align-middle font-semibold text-slate-700 text-xs">
                                                                {resInfo.periodConsHoras}h
                                                                <div className="text-[10px] text-slate-400 font-normal">({resInfo.periodConsMin.toLocaleString('pt-BR')}m)</div>
                                                            </td>
                                                            <td className="p-2 text-center align-middle">
                                                                <span className={`px-2.5 py-1 rounded text-[11px] font-bold text-white shadow-sm ${getOccupationColor(resInfo.periodTaxa)}`}>
                                                                    {resInfo.periodTaxa.toFixed(1)}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-xs sticky bottom-0 z-20 shadow-md">
                                                <tr>
                                                    <td className="p-3 sticky left-0 bg-slate-100 border-r shadow-[1px_0_0_0_rgba(226,232,240,1)] font-bold text-slate-800">
                                                        CAPACIDADE DO DIA
                                                    </td>
                                                    {allDates.map(d => {
                                                        const dayItems = (data || []).filter(item => item.data === d);
                                                        const totalDayCap = dayItems.reduce((acc, c) => acc + (Number(c.capacidade_diaria) || 0), 0);
                                                        const totalDayCons = dayItems.reduce((acc, c) => acc + (Number(c.minutos_consumidos) || 0), 0);
                                                        const dayTaxa = totalDayCap > 0 ? (totalDayCons / totalDayCap) * 100 : 0;
                                                        return (
                                                            <td key={d} className="p-2 text-center align-middle bg-slate-50 border-l border-slate-200">
                                                                <div className="text-[11px] font-bold text-slate-800">{Math.round(totalDayCap / 60)}h</div>
                                                                <div className="text-[10px] text-slate-500">{Math.round(totalDayCons / 60)}h ({dayTaxa.toFixed(0)}%)</div>
                                                            </td>
                                                        );
                                                    })}
                                                    {/* Totais do Período no Rodapé */}
                                                    <td className="p-2 text-center align-middle bg-blue-100 border-l-2 border-blue-300 font-bold text-blue-900 text-xs">
                                                        {periodStats.totalCapacidadeHoras}h
                                                    </td>
                                                    <td className="p-2 text-center align-middle bg-slate-200 font-bold text-slate-800 text-xs">
                                                        {periodStats.totalHorasConsumidas}h
                                                    </td>
                                                    <td className="p-2 text-center align-middle bg-slate-200">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white ${getOccupationColor(periodStats.taxaOcupacaoGeral)}`}>
                                                            {periodStats.taxaOcupacaoGeral.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                );
                            })()}

                            {viewMode === 'gantt' && (() => {
                                const allResourcesMap = {};
                                data.forEach(item => {
                                    if (!allResourcesMap[item.recurso_codigo]) {
                                        allResourcesMap[item.recurso_codigo] = { descri: item.recurso_descri, items: [] };
                                    }
                                    allResourcesMap[item.recurso_codigo].items.push(item);
                                });
                            
                                const resources = Object.keys(allResourcesMap).sort((a,b) => allResourcesMap[a].descri.localeCompare(allResourcesMap[b].descri));
                            
                                return (
                                    <div className="space-y-4">
                                        {resources.map(resCode => {
                                            const res = allResourcesMap[resCode];
                                            res.items.sort((a,b) => a.data.localeCompare(b.data));
                                            
                                            const resCapDiaria = res.items[0]?.capacidade_diaria || 480;
                                            const resInfo = periodStats.getResPeriodInfo(resCode, resCapDiaria);

                                            const isExpanded = expandedResources[resCode];
                                            const toggleExpand = () => {
                                                setExpandedResources(prev => ({
                                                    ...prev,
                                                    [resCode]: !prev[resCode]
                                                }));
                                            };

                                            return (
                                                <div key={resCode} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                                    <div 
                                                        className="font-bold text-slate-800 mb-2 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:text-blue-600 transition-colors"
                                                        onClick={toggleExpand}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                                            <span>{res.descri} <span className="text-slate-400 text-sm font-normal">({resCode})</span></span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs font-normal">
                                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-semibold border border-blue-100 flex items-center gap-1" title="Marcação da capacidade total no período filtrado">
                                                                <Gauge className="w-3.5 h-3.5 text-blue-600" />
                                                                Marcação Capacidade Período: {resInfo.periodCapHoras}h ({periodStats.numDiasUteis} dias úteis • {resCapDiaria} min/dia)
                                                            </span>
                                                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium border border-slate-200 flex items-center gap-1">
                                                                <Clock className="w-3.5 h-3.5 text-slate-600" />
                                                                Demanda no Período: {resInfo.periodConsHoras}h
                                                            </span>
                                                            <span className={`px-2.5 py-1 rounded-md font-bold text-white shadow-sm ${getOccupationColor(resInfo.periodTaxa)}`}>
                                                                Ocupação Período: {resInfo.periodTaxa.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Barra Visual de Comparação: Demanda no Período vs Marcação de Capacidade */}
                                                    <div className="mt-2 mb-3 px-1">
                                                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                                            <span>Carga no Período: <strong className="text-slate-800">{resInfo.periodConsHoras}h</strong> de <strong className="text-blue-700">{resInfo.periodCapHoras}h</strong> de capacidade</span>
                                                            <span className="font-semibold text-slate-600">Limite de Capacidade (100%)</span>
                                                        </div>
                                                        <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-visible">
                                                            <div 
                                                                className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(resInfo.periodTaxa)}`}
                                                                style={{ width: `${Math.min(resInfo.periodTaxa, 100)}%` }}
                                                            />
                                                            {/* Marcação 100% da Capacidade */}
                                                            <div 
                                                                className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-slate-800 z-10" 
                                                                style={{ left: '100%' }}
                                                                title="Marcação de 100% da Capacidade do Período"
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    {isExpanded && (
                                                        <div className="space-y-3 mt-4 ml-7">
                                                            {res.items.map(item => {
                                                                const percent = Math.min(item.taxa_ocupacao, 100);
                                                                const isOverloaded = item.taxa_ocupacao > 100;
                                                                return (
                                                                    <div key={item.data} className="flex items-start gap-4 text-sm bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                                                        <div className="w-24 font-medium text-slate-600 shrink-0 pt-1">
                                                                            {formatDateBR(item.data)}
                                                                        </div>
                                                                        <div className="flex-1 flex flex-col gap-2">
                                                                            {/* PLAN BAR */}
                                                                            <div className="flex items-center gap-3 w-full">
                                                                                <div 
                                                                                    className="relative h-3 bg-slate-100 rounded-full overflow-visible flex-1 cursor-pointer group" 
                                                                                    onClick={() => setSelectedDetail({ data: item.data, recurso: item })}
                                                                                    title={`Capacidade: ${item.capacidade_diaria}m | Consumo: ${item.minutos_consumidos}m`}
                                                                                >
                                                                                    <div 
                                                                                        className={`absolute left-0 top-0 bottom-0 rounded-full ${isOverloaded ? 'bg-red-500' : (percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500')} transition-all group-hover:brightness-110`}
                                                                                        style={{ width: `${percent}%` }}
                                                                                    />
                                                                                    {/* Marcação de Capacidade Diária */}
                                                                                    <div 
                                                                                        className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-slate-800 z-10" 
                                                                                        style={{ left: '100%' }}
                                                                                        title="Marcação de 100% da Capacidade do Dia"
                                                                                    />
                                                                                    {isOverloaded && (
                                                                                        <div 
                                                                                            className="absolute top-0 bottom-0 bg-red-700/50 rounded-r-full"
                                                                                            style={{ left: '100%', width: `${Math.min(item.taxa_ocupacao - 100, 100)}%` }}
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-xs font-semibold text-slate-700 w-48 shrink-0">
                                                                                    Carga: {item.taxa_ocupacao.toFixed(1)}% <span className="text-slate-400 font-normal">({Math.round(item.minutos_consumidos)}m / {item.capacidade_diaria}m)</span>
                                                                                </span>
                                                                            </div>
                                                                            
                                                                            {/* EXECUTED BAR */}
                                                                            <div className="flex items-center gap-3 w-full">
                                                                                <div 
                                                                                    className="relative h-3 bg-slate-100 rounded-full overflow-hidden flex-1 cursor-pointer group" 
                                                                                    onClick={() => setSelectedDetail({ data: item.data, recurso: item })}
                                                                                    title={`Executado: ${Math.round(item.minutos_executados || 0)}m`}
                                                                                >
                                                                                    <div 
                                                                                        className="absolute left-0 top-0 bottom-0 bg-blue-500 transition-all group-hover:brightness-110 rounded-full"
                                                                                        style={{ width: `${Math.min(item.percentual_executado || 0, 100)}%` }}
                                                                                    />
                                                                                </div>
                                                                                <span className="text-xs font-semibold text-blue-700 w-48 shrink-0">
                                                                                    Executado: {(item.percentual_executado || 0).toFixed(1)}% <span className="text-slate-400 font-normal">({Math.round(item.minutos_executados || 0)}m)</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            )}
            </div>

            {/* MODAL DETALHAMENTO */}
            {selectedDetail && (() => {
                const filteredOps = (modalOps || []).filter(o => 
                    o.qtde_pendente > 0 &&
                    ((o.op || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
                    (o.base_op || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                    (o.fraction_letter || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                    (o.pedido || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                    (o.cliente || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                    (o.produto || '').toLowerCase().includes(modalSearchTerm.toLowerCase()))
                );

                const totalMinutosEstimados = filteredOps.reduce((acc, curr) => acc + (curr.minutos_estimados || 0), 0);
                const totalHorasEstimadas = (totalMinutosEstimados / 60).toFixed(1);
                const resInfo = periodStats.getResPeriodInfo(selectedDetail.recurso.recurso_codigo, Number(selectedDetail.recurso.capacidade_diaria || 480));

                const isAllSelected = filteredOps.length > 0 && selectedOps.length === filteredOps.length;

                const toggleSelectAll = () => {
                    if (isAllSelected) {
                        setSelectedOps([]);
                    } else {
                        setSelectedOps(filteredOps.map(o => getRowKey(o)));
                    }
                };

                const toggleSelectOp = (rowKey) => {
                    if (selectedOps.includes(rowKey)) {
                        setSelectedOps(selectedOps.filter(id => id !== rowKey));
                    } else {
                        setSelectedOps([...selectedOps, rowKey]);
                    }
                };

                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    Detalhamento de Carga
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {selectedDetail.recurso.recurso_descri} ({selectedDetail.recurso.recurso_codigo}) - Data: {formatDateBR(selectedDetail.data)}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                                    <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md font-semibold text-blue-900 shadow-sm flex items-center gap-1.5">
                                        <Gauge className="w-3.5 h-3.5 text-blue-600" />
                                        Capacidade Diária: {Number(selectedDetail.recurso.capacidade_diaria || 480).toLocaleString('pt-BR')} min ({((Number(selectedDetail.recurso.capacidade_diaria || 480)) / 60).toFixed(1)}h)
                                    </span>
                                    <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-md font-semibold text-indigo-900 shadow-sm flex items-center gap-1.5" title="Capacidade total deste recurso no período filtrado">
                                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                        Marcação Capacidade Período: {resInfo.periodCapHoras}h ({periodStats.numDiasUteis} dias úteis)
                                    </span>
                                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-800 shadow-sm flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                                        Carga no Dia: {totalMinutosEstimados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min ({totalHorasEstimadas}h)
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md font-bold text-white shadow-sm ${getOccupationColor((totalMinutosEstimados / (Number(selectedDetail.recurso.capacidade_diaria) || 480)) * 100)}`}>
                                        Ocupação Dia: {((totalMinutosEstimados / (Number(selectedDetail.recurso.capacidade_diaria) || 480)) * 100).toFixed(1)}%
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-md font-bold text-white shadow-sm ${getOccupationColor(resInfo.periodTaxa)}`} title={`Demanda Total no Período: ${resInfo.periodConsHoras}h`}>
                                        Ocupação Período: {resInfo.periodTaxa.toFixed(1)}% ({resInfo.periodConsHoras}h)
                                    </span>
                                </div>
                            </div>
                            
                            {/* Barra de Busca de OP/Pedido/Cliente */}
                            <div className="relative w-72 mx-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar OP, Fração, Pedido, Cliente..."
                                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={modalSearchTerm}
                                    onChange={(e) => setModalSearchTerm(e.target.value)}
                                />
                            </div>

                            <button 
                                onClick={() => {
                                    setSelectedDetail(null);
                                    setModalSearchTerm('');
                                    setSelectedOps([]);
                                    setModalTab('ops');
                                }}
                                className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none px-2 ml-auto"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Abas */}
                        <div className="flex border-b border-slate-200 bg-white px-6">
                            <button 
                                onClick={() => setModalTab('ops')}
                                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${modalTab === 'ops' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Operações Planejadas
                            </button>
                            <button 
                                onClick={() => setModalTab('historico')}
                                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${modalTab === 'historico' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Histórico de Alterações
                            </button>
                        </div>

                        {/* Barra de Ação em Lote */}
                        {modalTab === 'ops' && selectedOps.length > 0 && (
                            <div className="bg-blue-50/50 border-b border-blue-100 px-6 py-3 flex items-center gap-4">
                                <span className="text-sm font-medium text-blue-800 flex-shrink-0">
                                    {selectedOps.length} OPs selecionadas:
                                </span>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date" 
                                        className="px-2 py-1.5 border border-blue-200 rounded text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                        value={bulkDates.inicio}
                                        onChange={e => {
                                            const newInicio = e.target.value;
                                            const updates = { inicio: newInicio };
                                            if (bulkDates.fim !== '' && bulkDates.fim < newInicio) {
                                                updates.fim = newInicio;
                                            }
                                            setBulkDates(prev => ({ ...prev, ...updates }));
                                        }}
                                        title="Início Planejado em Lote"
                                    />
                                    <input 
                                        type="date" 
                                        className="px-2 py-1.5 border border-blue-200 rounded text-sm w-36 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                        value={bulkDates.fim}
                                        onChange={e => setBulkDates({...bulkDates, fim: e.target.value})}
                                        title="Fim Planejado em Lote"
                                    />
                                    <button 
                                        onClick={handleBulkSave}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Aplicar a Todos
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <div className="p-6 overflow-y-auto flex-1 relative min-h-[250px]">
                            {loadingOps && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20 space-y-4">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-slate-500 font-medium animate-pulse">Carregando detalhes das ordens...</p>
                                </div>
                            )}
                            {modalTab === 'ops' ? (
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                checked={isAllSelected}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="px-4 py-3 font-semibold">Ordem de Produção</th>
                                        <th className="px-4 py-3 font-semibold">Pedido / Item</th>
                                        <th className="px-4 py-3 font-semibold">Cliente</th>
                                        <th className="px-4 py-3 font-semibold">Produto</th>
                                        <th className="px-4 py-3 font-semibold text-center">Início Planejado</th>
                                        <th className="px-4 py-3 font-semibold text-right">Qtd. Pendente</th>
                                        <th className="px-4 py-3 font-semibold text-right">Tempo Unitário</th>
                                        <th className="px-4 py-3 font-semibold text-right">Carga Estimada</th>
                                        <th className="px-4 py-3 font-semibold text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredOps.length > 0 ? (
                                        filteredOps.map((opItem, idx) => {
                                            const rowKey = getRowKey(opItem);
                                            const isEditing = editingOp === rowKey;
                                            const isChecked = selectedOps.includes(rowKey);
                                            
                                            // Converte YYYYMMDD para YYYY-MM-DD para o input type="date"
                                            const formatForInput = (yyyymmdd) => {
                                                if (!yyyymmdd || yyyymmdd.length !== 8) return '';
                                                return `${yyyymmdd.substring(0,4)}-${yyyymmdd.substring(4,6)}-${yyyymmdd.substring(6,8)}`;
                                            };

                                            return (
                                            <tr key={idx} className={`hover:bg-slate-50 ${isChecked ? 'bg-blue-50/30' : ''}`}>
                                                <td className="px-4 py-3 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                                        checked={isChecked}
                                                        onChange={() => toggleSelectOp(rowKey)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    {renderOpBadge(opItem.op)}
                                                    {opItem.sequen && opItem.sequen !== '001' && (
                                                        <span className="text-[10px] text-slate-400 block font-normal">
                                                            Seq: {opItem.sequen} {opItem.item_op ? `· Item: ${opItem.item_op}` : ''}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {opItem.pedido ? (
                                                        <span className="font-medium text-slate-700">{opItem.pedido} / {opItem.item_pedido}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">Sem pedido</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 max-w-[150px] truncate" title={opItem.cliente}>
                                                    {opItem.cliente || <span className="text-slate-400 italic text-xs">N/A</span>}
                                                </td>
                                                <td className="px-4 py-3">{opItem.produto}</td>
                                                
                                                <td className="px-4 py-3 text-center">
                                                    {isEditing ? (
                                                        <input 
                                                            type="date" 
                                                            className="px-2 py-1 border border-blue-300 rounded text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            value={editDates.inicio}
                                                            onChange={e => {
                                                                const newInicio = e.target.value;
                                                                const updates = { inicio: newInicio, fim: newInicio };
                                                                setEditDates(prev => ({ ...prev, ...updates }));
                                                            }}
                                                        />
                                                    ) : (
                                                        formatDateBR(opItem.data_planejada)
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-right font-medium text-blue-600">{opItem.qtde_pendente}</td>
                                                <td className="px-4 py-3 text-right text-slate-500 text-xs">
                                                    {(opItem.minutos_estimados / (opItem.qtde_pendente || 1)).toFixed(2)} min
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {opItem.minutos_estimados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => handleSaveDates(opItem)}
                                                                className="text-green-600 hover:bg-green-50 p-1.5 rounded transition-colors"
                                                                title="Salvar"
                                                            >
                                                                <Save className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingOp(null)}
                                                                className="text-slate-400 hover:bg-slate-100 p-1.5 rounded transition-colors"
                                                                title="Cancelar"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => {
                                                                setEditingOp(rowKey);
                                                                setEditDates({
                                                                    inicio: formatForInput(opItem.data_planejada),
                                                                    fim: formatForInput(opItem.data_planejada_final)
                                                                });
                                                            }}
                                                            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors mx-auto block"
                                                            title="Editar Datas"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="9" className="px-4 py-8 text-center text-slate-500">
                                                Nenhuma OP detalhada encontrada com os filtros atuais.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {filteredOps.length > 0 && (
                                    <tfoot className="border-t-2 border-slate-300 bg-slate-50 sticky bottom-0">
                                        <tr>
                                            <td colSpan="6" className="px-4 py-3 text-right font-bold text-slate-700 text-sm">
                                                TOTAL ({filteredOps.length} OPs):
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                {filteredOps.reduce((acc, o) => acc + (o.qtde_pendente || 0), 0).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs font-bold">—</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                                                {totalMinutosEstimados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min
                                                <span className="block text-xs text-slate-500 font-normal">({totalHorasEstimadas}h)</span>
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                            ) : (
                            <div className="space-y-4">
                                {loadingHistorico ? (
                                    <div className="text-center py-8 text-slate-500">Carregando histórico...</div>
                                ) : (() => {
                                    const filteredHistorico = historicoData.filter(hist => 
                                        modalOps?.some(op => 
                                            op.op === hist.op_numero && 
                                            op.operacao === hist.operacao_codigo
                                        )
                                    );

                                    if (filteredHistorico.length === 0) {
                                        return <div className="text-center py-8 text-slate-500">Nenhum histórico de alteração encontrado para as OPs desta carga.</div>;
                                    }

                                    return (
                                    <table className="w-full text-sm text-left text-slate-600">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">Data/Hora</th>
                                                <th className="px-4 py-3 font-semibold">Usuário</th>
                                                <th className="px-4 py-3 font-semibold">OP / Operação</th>
                                                <th className="px-4 py-3 font-semibold text-red-600">Mudou De</th>
                                                <th className="px-4 py-3 font-semibold text-green-600">Mudou Para</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredHistorico.map(hist => (
                                                <tr key={hist.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 whitespace-nowrap">{new Date(hist.data_alteracao).toLocaleString('pt-BR')}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-800">{hist.usuario}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-700">{hist.op_numero} / {hist.operacao_codigo}</td>
                                                    <td className="px-4 py-3 text-red-600 text-xs">
                                                        {hist.mudou_de}
                                                    </td>
                                                    <td className="px-4 py-3 text-green-600 font-medium text-xs">
                                                        {hist.mudou_para}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    );
                                })()}
                            </div>
                            )}
                        </div>
                        
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => {
                                    setSelectedDetail(null);
                                    setModalSearchTerm('');
                                    setSelectedOps([]);
                                }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default TaxaOcupacao;
