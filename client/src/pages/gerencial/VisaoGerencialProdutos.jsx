import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getVisaoGerencialFabrica, saveSnapshotFabrica, getKpiFaturar } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { Factory, Calendar, DollarSign, Lock, ChevronDown, ChevronRight, Package, Download, Camera, CheckSquare, Clock, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ErrorStateOverlay from '../../components/ErrorStateOverlay';

const VisaoGerencialProdutos = () => {
    const { user, hasPermission } = useAuth();
    // Core State
    const [data, setData] = useState([]);
    const [kpiData, setKpiData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [savingSnapshot, setSavingSnapshot] = useState(false);
    const exportRef = useRef(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState('futuro'); // atrasados | futuro | financeiro
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedProducts, setExpandedProducts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    // Gantt UI State
    const [ganttGroupMode, setGanttGroupMode] = useState('cliente'); // 'cliente' | 'pedido'
    const [expandedGantt, setExpandedGantt] = useState({});
    const [ganttStartDate, setGanttStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 15);
        return d.toISOString().split('T')[0];
    });
    const [ganttEndDate, setGanttEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 75);
        return d.toISOString().split('T')[0];
    });

    const [isGanttFullscreen, setIsGanttFullscreen] = useState(false);

    const toggleGanttNode = (key) => {
        setExpandedGantt(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const canViewFinance = hasPermission('valores_financeiros', 'view');

    const fetchData = async (startDate = null, endDate = null) => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const [resp, kpiResp] = await Promise.all([
                getVisaoGerencialFabrica(params),
                getKpiFaturar()
            ]);
            setData(resp.data || []);
            setKpiData(kpiResp.data || []);
        } catch (err) {
            console.error(err);
            setError('Falha ao carregar visão da fábrica. Verifique a conexão com o backend.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'gantt') {
            fetchData(ganttStartDate, ganttEndDate);
        } else {
            fetchData();
        }
    }, [activeTab, ganttStartDate, ganttEndDate]);

    const handleSnapshot = async () => {
        setSavingSnapshot(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const payload = {
                snapshot_date: today,
                total_pedidos: data.length,
                total_produtos: new Set(data.map(d => d.codigo)).size,
                total_atraso_qtd: processedData.metrics.atraso.qtd,
                total_futuro_qtd: processedData.metrics.futuro.qtd,
                total_atraso_brl: processedData.metrics.atraso.brl,
                total_futuro_brl: processedData.metrics.futuro.brl,
            };
            await saveSnapshotFabrica(payload);
            alert('Snapshot Diário salvo com sucesso no Banco de Dados para controle histórico!');
        } catch(e) {
            alert('Erro ao salvar snapshot.');
            console.error(e);
        } finally {
            setSavingSnapshot(false);
        }
    };

    const exportToPDF = async () => {
        if (!exportRef.current) return;
        const element = exportRef.current;
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4'); /* Landscape */
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.text("Resumo Gerencial - Fabrica e PCP", 15, 10);
        pdf.addImage(imgData, 'PNG', 0, 15, pdfWidth, pdfHeight);
        pdf.save(`Resumo_PCP_Fabrica_${new Date().toLocaleDateString('pt-BR').replace(/[\/]/g, '-')}.pdf`);
    };

    // Toggle Expansion
    const toggleGroup = (group) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    const toggleProduct = (prodKey) => setExpandedProducts(prev => ({ ...prev, [prodKey]: !prev[prodKey] }));

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // Get "Quinzena" Helper
    const getQuinzenaName = (dateStr) => {
        if (!dateStr || dateStr.length < 8) return 'Sem Data';
        const [d, m, y] = dateStr.split('/');
        const day = parseInt(d, 10);
        const prefix = day <= 15 ? '1ª Quinzena' : '2ª Quinzena';
        
        // Month names
        const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const monthName = months[parseInt(m, 10)-1] || m;

        // Check if it's past
        // Para atrasados podemos manter Agrupamento por Mês, mas a regra pediu Quinzena pra Tudo.
        return `${prefix} de ${monthName}/20${y}`;
    };

    // Data Processing (Memoized for performance)
    const processedData = useMemo(() => {
        const result = {
            atrasados: [],
            futuros: [],
            metrics: {
                atraso: { qtd: 0, brl: 0 },
                futuro: { qtd: 0, brl: 0 },
                totalGeralQtd: 0,
                totalGeralBrl: 0
            },
            treeAtrasados: {},
            treeFuturos: {},
            chartData: []
        };

        const _atrasados = [];
        const _futuros = [];

        data.forEach(item => {
            const isDelayed = parseInt(item.dias_atraso, 10) > 0;
            const qtd = parseFloat(item.qtd_faturar) || 0;
            const brl = parseFloat(item.valor_saldo) || 0;

            result.metrics.totalGeralQtd += qtd;
            result.metrics.totalGeralBrl += brl;

            if (isDelayed) {
                result.metrics.atraso.qtd += qtd;
                result.metrics.atraso.brl += brl;
                _atrasados.push(item);
            } else {
                result.metrics.futuro.qtd += qtd;
                result.metrics.futuro.brl += brl;
                _futuros.push(item);
            }
        });

        // Search Filter
        const term = searchTerm.toLowerCase();
        const filterItem = (i) => !term || 
            (i.codigo && i.codigo.toLowerCase().includes(term)) || 
            (i.descricao && i.descricao.toLowerCase().includes(term)) ||
            (i.nome_cliente && i.nome_cliente.toLowerCase().includes(term));

        const constructTree = (list, isPastFolder) => {
            const tree = {};
            list.filter(filterItem).forEach(item => {
                const groupKey = getQuinzenaName(item.entrega_formatada);
                const prodKey = `${item.codigo} - ${item.descricao}`;

                if(!tree[groupKey]) tree[groupKey] = {
                    groupKey, totalQtd: 0, totalBrl: 0, products: {}
                };
                let grp = tree[groupKey];
                grp.totalQtd += parseFloat(item.qtd_faturar || 0);
                grp.totalBrl += parseFloat(item.valor_saldo || 0);

                if(!grp.products[prodKey]) grp.products[prodKey] = {
                    prodKey, totalQtd: 0, totalBrl: 0, items: []
                };
                let prd = grp.products[prodKey];
                prd.totalQtd += parseFloat(item.qtd_faturar || 0);
                prd.totalBrl += parseFloat(item.valor_saldo || 0);

                prd.items.push(item);
            });
            return Object.values(tree).sort((a,b) => {
                // Sorting logic: Sort by Year, Month, Quinzena. For simplicity, we just sort by date of first item.
                const getDateScore = (d1Str) => {
                    if(!d1Str) return 0;
                    const aItem = Object.values(d1Str.products)[0]?.items[0]?.entrega_formatada;
                    if(!aItem) return 0;
                    const [dd, mm, yy] = aItem.split('/');
                    return parseInt(`20${yy}${mm}${dd}`, 10) || 0;
                };
                // Atrasados: Most delayed first (asc order score). Futuros: closest ones first. (Asc order score).
                return getDateScore(a) - getDateScore(b);
            });
        };

        result.treeAtrasados = constructTree(_atrasados, true);
        result.treeFuturos = constructTree(_futuros, false);

        // Chart Data (Carga Fabril Atrasada vs Futura)
        result.chartData = [
            { name: 'Em Atraso', Qtd: result.metrics.atraso.qtd, Valor: result.metrics.atraso.brl },
            { name: 'Entrega Futura', Qtd: result.metrics.futuro.qtd, Valor: result.metrics.futuro.brl }
        ];

        return result;
    }, [data, searchTerm]);

    const parseDateObjGlobal = (dStr) => {
        if (!dStr || dStr.trim() === '' || dStr.length < 8) return null;
        const y = parseInt(dStr.substring(0, 4), 10);
        const m = parseInt(dStr.substring(4, 6), 10) - 1;
        const d = parseInt(dStr.substring(6, 8), 10);
        return new Date(y, m, d);
    };

    const parsePcpDateObjGlobal = (val) => {
        if (!val) return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };

    const weeksList = useMemo(() => {
        const weeks = [];
        if (!ganttStartDate || !ganttEndDate) return weeks;
        const start = new Date(ganttStartDate + 'T00:00:00');
        const end = new Date(ganttEndDate + 'T23:59:59');

        const startDay = start.getDay();
        const startDiff = start.getDate() - startDay + (startDay === 0 ? -6 : 1);
        const current = new Date(start);
        current.setDate(startDiff);
        current.setHours(0, 0, 0, 0);

        while (current <= end) {
            const weekStart = new Date(current);
            const weekEnd = new Date(current);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const label = weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const monthLabel = weekStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

            weeks.push({
                start: weekStart,
                end: weekEnd,
                label,
                monthLabel
            });
            current.setDate(current.getDate() + 7);
        }
        return weeks;
    }, [ganttStartDate, ganttEndDate]);

    const ganttData = useMemo(() => {
        if (!ganttStartDate || !ganttEndDate || weeksList.length === 0) return [];
        const timelineStart = weeksList[0].start;
        const timelineEnd = weeksList[weeksList.length - 1].end;

        const term = searchTerm.toLowerCase();
        
        const filtered = data.filter(item => {
            const matchesText = !term || 
                (item.codigo && item.codigo.toLowerCase().includes(term)) || 
                (item.descricao && item.descricao.toLowerCase().includes(term)) ||
                (item.nome_cliente && item.nome_cliente.toLowerCase().includes(term)) ||
                (item.pedido && item.pedido.toLowerCase().includes(term));

            if (!matchesText) return false;

            const emission = parseDateObjGlobal(item.c5_emissao_raw);
            const delivery = parseDateObjGlobal(item.c6_entreg_raw);
            const pcp = parsePcpDateObjGlobal(item.data_entrega_pcp);

            let start = emission;
            let end = pcp || delivery;

            if (!end) {
                if (start) {
                    end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
                } else {
                    return false;
                }
            }
            if (!start) {
                start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            }
            if (start > end) {
                start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            }

            return start <= timelineEnd && end >= timelineStart;
        });

        if (ganttGroupMode === 'cliente') {
            const clientGroup = {};
            filtered.forEach(item => {
                const clientKey = `${item.cod_cliente} - ${item.nome_cliente || 'Cliente Sem Nome'}`;
                if (!clientGroup[clientKey]) {
                    clientGroup[clientKey] = {
                        key: clientKey,
                        name: item.nome_cliente || item.cod_cliente,
                        code: item.cod_cliente,
                        orders: {},
                        totalQtd: 0,
                        totalSaldo: 0,
                        totalOriginalQtd: 0,
                        totalDeliveredQtd: 0
                    };
                }
                const cg = clientGroup[clientKey];
                cg.totalQtd += parseFloat(item.qtd_faturar || 0);
                cg.totalSaldo += parseFloat(item.valor_saldo || 0);
                cg.totalOriginalQtd += parseFloat(item.quantidade || 0);
                cg.totalDeliveredQtd += parseFloat(item.qtd_entreg || 0);

                const orderKey = item.pedido;
                if (!cg.orders[orderKey]) {
                    cg.orders[orderKey] = {
                        key: `${clientKey}_${orderKey}`,
                        pedido: item.pedido,
                        items: [],
                        totalQtd: 0,
                        totalSaldo: 0,
                        totalOriginalQtd: 0,
                        totalDeliveredQtd: 0
                    };
                }
                const og = cg.orders[orderKey];
                og.totalQtd += parseFloat(item.qtd_faturar || 0);
                og.totalSaldo += parseFloat(item.valor_saldo || 0);
                og.totalOriginalQtd += parseFloat(item.quantidade || 0);
                og.totalDeliveredQtd += parseFloat(item.qtd_entreg || 0);
                og.items.push(item);
            });

            return Object.values(clientGroup).map(cg => {
                const orders = Object.values(cg.orders).map(og => {
                    let minEmissionObj = null;
                    let maxDeliveryObj = null;
                    let maxPcpObj = null;
                    let hasPcpForecast = false;

                    og.items.forEach(item => {
                        const em = parseDateObjGlobal(item.c5_emissao_raw);
                        const de = parseDateObjGlobal(item.c6_entreg_raw);
                        const pc = parsePcpDateObjGlobal(item.data_entrega_pcp);

                        if (em) {
                            if (!minEmissionObj || em < minEmissionObj) minEmissionObj = em;
                        }
                        if (de) {
                            if (!maxDeliveryObj || de > maxDeliveryObj) maxDeliveryObj = de;
                        }
                        
                        const pcVal = pc || de;
                        if (pc) hasPcpForecast = true;
                        if (pcVal) {
                            if (!maxPcpObj || pcVal > maxPcpObj) maxPcpObj = pcVal;
                        }
                    });

                    return {
                        ...og,
                        minEmissionObj,
                        maxDeliveryObj,
                        maxPcpObj,
                        hasPcpForecast,
                        evolutionPct: og.totalOriginalQtd > 0 ? (og.totalDeliveredQtd / og.totalOriginalQtd) * 100 : 0
                    };
                });

                return {
                    ...cg,
                    orders,
                    evolutionPct: cg.totalOriginalQtd > 0 ? (cg.totalDeliveredQtd / cg.totalOriginalQtd) * 100 : 0
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
        } else {
            const orderGroup = {};
            filtered.forEach(item => {
                const orderKey = item.pedido;
                if (!orderGroup[orderKey]) {
                    orderGroup[orderKey] = {
                        key: orderKey,
                        pedido: item.pedido,
                        nome_cliente: item.nome_cliente || item.cod_cliente,
                        items: [],
                        totalQtd: 0,
                        totalSaldo: 0,
                        totalOriginalQtd: 0,
                        totalDeliveredQtd: 0
                    };
                }
                const og = orderGroup[orderKey];
                og.totalQtd += parseFloat(item.qtd_faturar || 0);
                og.totalSaldo += parseFloat(item.valor_saldo || 0);
                og.totalOriginalQtd += parseFloat(item.quantidade || 0);
                og.totalDeliveredQtd += parseFloat(item.qtd_entreg || 0);
                og.items.push(item);
            });

            return Object.values(orderGroup).map(og => {
                let minEmissionObj = null;
                let maxDeliveryObj = null;
                let maxPcpObj = null;
                let hasPcpForecast = false;

                og.items.forEach(item => {
                    const em = parseDateObjGlobal(item.c5_emissao_raw);
                    const de = parseDateObjGlobal(item.c6_entreg_raw);
                    const pc = parsePcpDateObjGlobal(item.data_entrega_pcp);

                    if (em) {
                        if (!minEmissionObj || em < minEmissionObj) minEmissionObj = em;
                    }
                    if (de) {
                        if (!maxDeliveryObj || de > maxDeliveryObj) maxDeliveryObj = de;
                    }
                    
                    const pcVal = pc || de;
                    if (pc) hasPcpForecast = true;
                    if (pcVal) {
                        if (!maxPcpObj || pcVal > maxPcpObj) maxPcpObj = pcVal;
                    }
                });

                return {
                    ...og,
                    minEmissionObj,
                    maxDeliveryObj,
                    maxPcpObj,
                    hasPcpForecast,
                    evolutionPct: og.totalOriginalQtd > 0 ? (og.totalDeliveredQtd / og.totalOriginalQtd) * 100 : 0
                };
            }).sort((a, b) => a.pedido.localeCompare(b.pedido));
        }
    }, [data, searchTerm, ganttGroupMode, ganttStartDate, ganttEndDate, weeksList]);

    const timelineStart = weeksList[0]?.start;
    const timelineEnd = weeksList[weeksList.length - 1]?.end;
    const timelineDuration = timelineStart && timelineEnd ? timelineEnd.getTime() - timelineStart.getTime() : 0;

    const getBarStyles = (startDateVal, endDateVal, isPcp = false, fallbackEndDateVal = null) => {
        if (!timelineStart || !timelineEnd || !timelineDuration) return null;
        
        let sDate = startDateVal instanceof Date ? startDateVal : parseDateObjGlobal(startDateVal);
        let eDate = null;
        
        if (endDateVal) {
            eDate = endDateVal instanceof Date ? endDateVal : (isPcp ? parsePcpDateObjGlobal(endDateVal) : parseDateObjGlobal(endDateVal));
        }

        if (isPcp && !eDate && fallbackEndDateVal) {
            eDate = fallbackEndDateVal instanceof Date ? fallbackEndDateVal : parseDateObjGlobal(fallbackEndDateVal);
        }

        if (!eDate) {
            if (sDate) {
                eDate = new Date(sDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else {
                return null;
            }
        }

        if (!sDate) {
            sDate = new Date(eDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        if (sDate > eDate) {
            sDate = new Date(eDate.getTime() - 24 * 60 * 60 * 1000);
        }

        const startMs = Math.max(timelineStart.getTime(), sDate.getTime());
        const endMs = Math.min(timelineEnd.getTime(), eDate.getTime());

        if (startMs >= endMs) return null;

        const leftPercent = ((startMs - timelineStart.getTime()) / timelineDuration) * 100;
        const widthPercent = ((endMs - startMs) / timelineDuration) * 100;

        return {
            left: `${leftPercent}%`,
            width: `${widthPercent}%`
        };
    };


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-500">Mapeando a fábrica. Aguarde...</p>
            </div>
        );
    }

    if (error) {
        return <div className="m-6"><ErrorStateOverlay error={error} onRetry={fetchData} /></div>;
    }

    // Dynamic Variables based on Tab
    const currentTree = activeTab === 'atrasados' ? processedData.treeAtrasados : processedData.treeFuturos;
    const isShowingFinance = activeTab === 'financeiro';

    return (
        <div className="p-6 bg-slate-50 h-screen flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-none flex flex-col md:flex-row md:items-center justify-between mb-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Factory className="text-indigo-600 h-6 w-6" />
                        Visão Global (Fábrica Inteira)
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Espelho de apontamento da fábrica agrupado por Mês/Quinzena e Produto.
                    </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <button onClick={handleSnapshot} disabled={savingSnapshot} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
                        {savingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        Snapshot BD
                    </button>
                    <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors">
                        <Download className="w-4 h-4" />
                        Gerar PDF
                    </button>
                </div>
            </div>

            {/* Content to be PDF Exported */}
            <div ref={exportRef} className="flex-1 flex flex-col min-h-0 space-y-4 pb-2">
                
                {/* KPIs */}
                {/* KPIs */}
                <div className="flex-none grid grid-cols-1 xl:grid-cols-6 gap-4 mb-2">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500 xl:col-span-1">
                         <div className="flex items-center justify-between">
                             <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Clock size={20} /></div>
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Em Atraso</span>
                         </div>
                         <div className="mt-4">
                             <h4 className="text-xl font-bold text-slate-800">{processedData.metrics.atraso.qtd.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-500">pçs</span></h4>
                             {canViewFinance && <div className="text-xs text-red-600 font-semibold mt-1">R$ {(processedData.metrics.atraso.brl / 1000).toFixed(0)}k</div>}
                         </div>
                    </div>
                    
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 xl:col-span-1">
                         <div className="flex items-center justify-between">
                             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckSquare size={20} /></div>
                             <span className="text-[10px] font-bold text-slate-400 uppercase">No Prazo</span>
                         </div>
                         <div className="mt-4">
                             <h4 className="text-xl font-bold text-slate-800">{processedData.metrics.futuro.qtd.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-500">pçs</span></h4>
                             {canViewFinance && <div className="text-xs text-emerald-600 font-semibold mt-1">R$ {(processedData.metrics.futuro.brl / 1000).toFixed(0)}k</div>}
                         </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm xl:col-span-2">
                        <h4 className="text-sm font-bold text-slate-600 mb-3">Distribuição de Carga</h4>
                        <div className="h-16">
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <BarChart data={processedData.chartData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} fontSize={10} tick={{fill: '#64748b'}} />
                                    <RechartsTooltip formatter={(val) => Math.floor(val).toLocaleString('pt-BR') + (isShowingFinance ? ' R$' : ' pçs')} />
                                    <Bar dataKey={isShowingFinance ? 'Valor' : 'Qtd'} barSize={10} radius={[0, 4, 4, 0]}>
                                        {processedData.chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Em Atraso' ? '#ef4444' : '#10b981'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm xl:col-span-2">
                        <h4 className="text-sm font-bold text-slate-600 mb-1">Status (Itens a Faturar)</h4>
                        <div className="h-36">
                            {kpiData && kpiData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <PieChart>
                                        <Pie
                                            data={kpiData}
                                            dataKey="total"
                                            nameKey="status_tipo_item"
                                            cx="32%"
                                            cy="50%"
                                            innerRadius={32}
                                            outerRadius={52}
                                            paddingAngle={2}
                                        >
                                            {kpiData.map((entry, index) => {
                                                const name = entry.status_tipo_item || '';
                                                let color = '#94a3b8';
                                                if (name.includes('Restrição')) color = '#ef4444';
                                                else if (name.includes('Revisão')) color = '#eab308';
                                                else if (name.includes('Novo')) color = '#14b8a6';
                                                else if (name === 'PCP (Com OP)') color = '#425750';
                                                else if (name.includes('Sem OP')) color = '#f97316';
                                                return <Cell key={`pie-cell-${index}`} fill={color} />;
                                            })}
                                        </Pie>
                                        <RechartsTooltip formatter={(val, name) => [`${Number(val).toLocaleString('pt-BR')} itens`, name]} />
                                        <Legend
                                            verticalAlign="middle"
                                            align="right"
                                            layout="vertical"
                                            iconSize={8}
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '4px' }}
                                            formatter={(value, entry) => `${value}: ${Number(entry.payload.total).toLocaleString('pt-BR')}`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-none flex items-center border-b border-slate-200 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('futuro')}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'futuro' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <Calendar className="w-4 h-4" /> Entregas Futuras
                        </button>
                        <button
                            onClick={() => setActiveTab('atrasados')}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'atrasados' ? 'border-red-600 text-red-700 bg-red-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <Clock className="w-4 h-4" /> Atrasados
                        </button>
                        <button
                            onClick={() => {
                                if(!canViewFinance) return alert('Seu perfil não possui acesso financeiro.');
                                setActiveTab('financeiro');
                            }}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'financeiro' ? 'border-slate-800 text-slate-900 bg-slate-100' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <DollarSign className="w-4 h-4" /> Visão Financeira (Tudo)
                            {!canViewFinance && <Lock className="w-3 h-3 ml-1 text-slate-400" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('gantt')}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'gantt' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            <Calendar className="w-4 h-4" /> Cronograma (Gantt)
                        </button>
                        
                        <div className="ml-auto pr-4 flex-shrink-0">
                            <input 
                                id="search-product"
                                name="search-product"
                                type="text"
                                placeholder="🔍 Buscar Produto..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 min-w-[200px]"
                            />
                        </div>
                    </div>

                    {/* Table / Gantt View */}
                    <div className="flex-1 overflow-auto flex flex-col min-h-0">
                        {activeTab === 'gantt' ? (
                            <div className={`flex flex-col flex-1 min-h-0 bg-white ${
                                isGanttFullscreen 
                                    ? 'fixed inset-0 z-[9999] p-6 w-screen h-screen bg-slate-50' 
                                    : 'relative'
                            }`}>
                                {/* Gantt Header Controls */}
                                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 flex-none">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                            <button
                                                onClick={() => setGanttGroupMode('cliente')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${ganttGroupMode === 'cliente' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                Agrupar por Cliente
                                            </button>
                                            <button
                                                onClick={() => setGanttGroupMode('pedido')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${ganttGroupMode === 'pedido' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                            >
                                                Agrupar por Pedido
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                            <span>Legenda:</span>
                                            <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded bg-blue-500/20 border border-blue-400 block"></span>
                                                    <span className="text-[11px] text-slate-700">Comercial (Protheus)</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-400 block"></span>
                                                    <span className="text-[11px] text-slate-700">PCP (No Prazo)</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-400 block"></span>
                                                    <span className="text-[11px] text-slate-700">PCP (Desvio)</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded border border-dashed border-slate-400 bg-slate-50/50 block"></span>
                                                    <span className="text-[11px] text-slate-700">Sem Previsão PCP</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Date range filters + Fullscreen toggle */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                                            <span className="text-slate-400 text-[10px] font-bold uppercase px-1">De</span>
                                            <input 
                                                type="date" 
                                                value={ganttStartDate}
                                                onChange={(e) => setGanttStartDate(e.target.value)}
                                                className="border-none bg-transparent outline-none text-xs font-semibold text-slate-700 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                                            <span className="text-slate-400 text-[10px] font-bold uppercase px-1">Até</span>
                                            <input 
                                                type="date" 
                                                value={ganttEndDate}
                                                onChange={(e) => setGanttEndDate(e.target.value)}
                                                className="border-none bg-transparent outline-none text-xs font-semibold text-slate-700 cursor-pointer"
                                            />
                                        </div>
                                        
                                        <button
                                            onClick={() => setIsGanttFullscreen(!isGanttFullscreen)}
                                            className={`p-2 border border-slate-200 bg-white rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold ${
                                                isGanttFullscreen 
                                                    ? 'text-red-600 hover:text-red-700 border-red-200 bg-red-50/20' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                            title={isGanttFullscreen ? "Voltar ao normal" : "Ver em tela cheia"}
                                        >
                                            {isGanttFullscreen ? (
                                                <>
                                                    <Minimize2 className="w-4 h-4" />
                                                    <span>Sair</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Maximize2 className="w-4 h-4" />
                                                    <span>Tela Cheia</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Gantt Chart Core Table */}
                                <div className="flex-1 overflow-auto relative">
                                    <div className="flex flex-col min-w-max">
                                        {/* Calendar Header Row */}
                                        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
                                            <div className="w-[320px] p-3 font-semibold text-[11px] text-slate-500 uppercase border-r border-slate-200 bg-slate-50 sticky left-0 z-30 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                <span>Estrutura de Vendas</span>
                                                <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-normal lowercase">faturamento pendente</span>
                                            </div>
                                            <div className="flex relative" style={{ width: `${weeksList.length * 100}px` }}>
                                                {weeksList.map((week, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className="flex-shrink-0 text-center border-r border-slate-200/50 py-2 flex flex-col justify-center"
                                                        style={{ width: '100px' }}
                                                    >
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{week.monthLabel}</span>
                                                        <span className="text-[11px] text-slate-700 font-bold">{week.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Body Rows */}
                                        <div className="divide-y divide-slate-100">
                                            {ganttData.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 bg-white">Nenhum dado encontrado para o período ou busca selecionada.</div>
                                            ) : ganttGroupMode === 'cliente' ? (
                                                // RENDER CLIENT GROUP MODE
                                                ganttData.map(client => {
                                                    const isClientOpen = expandedGantt[client.key];
                                                    return (
                                                        <React.Fragment key={client.key}>
                                                            {/* CUSTOMER ROW */}
                                                            <div className="flex hover:bg-slate-50/40 transition-colors group">
                                                                <div 
                                                                    onClick={() => toggleGanttNode(client.key)}
                                                                    className="w-[320px] p-3 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-center gap-2 cursor-pointer shadow-[2px_0_5px_rgba(0,0,0,0.02)] select-none"
                                                                >
                                                                    <div className="text-slate-400">{isClientOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                                                                    <div className="truncate flex-1">
                                                                        <div className="font-bold text-slate-800 text-xs truncate" title={client.name}>{client.name}</div>
                                                                        <div className="text-[10px] text-slate-400">Cód: {client.code}</div>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0 text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                                                        {client.totalQtd.toLocaleString('pt-BR')} pçs
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Blank timeline cell for customer row */}
                                                                <div className="flex relative items-center bg-slate-50/20" style={{ width: `${weeksList.length * 100}px`, height: '46px' }}>
                                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                                        {weeksList.map((_, idx) => (
                                                                            <div key={idx} className="h-full border-r border-slate-100/70" style={{ width: '100px' }} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* ORDERS UNDER CUSTOMER */}
                                                            {isClientOpen && client.orders.map(order => {
                                                                const isOrderOpen = expandedGantt[order.key];
                                                                return (
                                                                    <React.Fragment key={order.key}>
                                                                        <div className="flex hover:bg-slate-50/40 transition-colors">
                                                                            <div 
                                                                                onClick={() => toggleGanttNode(order.key)}
                                                                                className="w-[320px] p-3 pl-8 border-r border-slate-200 bg-slate-50/50 sticky left-0 z-10 flex items-center gap-2 cursor-pointer shadow-[2px_0_5px_rgba(0,0,0,0.02)] select-none border-l-[3px] border-l-indigo-400"
                                                                            >
                                                                                <div className="text-slate-400">{isOrderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                                                                                <div className="truncate flex-1">
                                                                                    <div className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                                                                                        <span>Pedido: {order.pedido}</span>
                                                                                        {order.evolutionPct > 0 && (
                                                                                            <span className="text-[9px] bg-emerald-100 border border-emerald-300 text-emerald-800 px-1 rounded-full font-bold">
                                                                                                {order.evolutionPct.toFixed(0)}%
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-slate-400">{order.items.length} itens pendentes</div>
                                                                                </div>
                                                                                <div className="text-right flex-shrink-0 text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">
                                                                                    {order.totalQtd.toLocaleString('pt-BR')} pçs
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex relative items-center bg-slate-50/10" style={{ width: `${weeksList.length * 100}px`, height: '56px' }}>
                                                                                <div className="absolute inset-0 flex pointer-events-none">
                                                                                    {weeksList.map((_, idx) => (
                                                                                        <div key={idx} className="h-full border-r border-slate-100/70" style={{ width: '100px' }} />
                                                                                    ))}
                                                                                </div>

                                                                                {/* Consolidated Gantt Bars for the Order */}
                                                                                {(() => {
                                                                                    const orderBarCom = getBarStyles(order.minEmissionObj, order.maxDeliveryObj, false);
                                                                                    const orderBarPcp = getBarStyles(order.minEmissionObj, order.maxPcpObj || order.maxDeliveryObj, true);
                                                                                    const isOrderPcpDelayed = order.maxPcpObj && order.maxDeliveryObj && order.maxPcpObj > order.maxDeliveryObj;
                                                                                    
                                                                                    return (
                                                                                        <div className="w-full h-full relative flex flex-col justify-center gap-1.5 py-1 pointer-events-none">
                                                                                            {orderBarCom && (
                                                                                                <div 
                                                                                                    className="absolute h-3 bg-blue-500/15 border border-blue-400 rounded shadow-sm flex items-center justify-center top-[10px] select-none hover:bg-blue-500/30 transition-all group/bar pointer-events-auto cursor-help"
                                                                                                    style={orderBarCom}
                                                                                                >
                                                                                                    <span className="text-[7px] text-blue-700 font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">COM: {order.minEmissionObj?.toLocaleDateString('pt-BR')} - {order.maxDeliveryObj?.toLocaleDateString('pt-BR')}</span>
                                                                                                    
                                                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                                        <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-blue-300">Prazo Comercial (Total Pedido)</div>
                                                                                                        <div>📦 <strong>Pedido:</strong> {order.pedido}</div>
                                                                                                        <div>📊 <strong>Saldo:</strong> {order.totalQtd.toLocaleString('pt-BR')} pçs</div>
                                                                                                        <div>📅 <strong>Início:</strong> {order.minEmissionObj?.toLocaleDateString('pt-BR')}</div>
                                                                                                        <div>📅 <strong>Entrega:</strong> {order.maxDeliveryObj?.toLocaleDateString('pt-BR')}</div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}

                                                                                            {orderBarPcp && (
                                                                                                <div
                                                                                                    className={`absolute h-3 rounded shadow-sm flex items-center justify-center bottom-[10px] border select-none hover:brightness-95 transition-all group/bar pointer-events-auto cursor-help ${
                                                                                                        !order.maxPcpObj
                                                                                                            ? 'bg-slate-50/50 border-dashed border-slate-400 text-slate-500'
                                                                                                            : isOrderPcpDelayed
                                                                                                                ? 'bg-amber-100 border-amber-400 text-amber-800'
                                                                                                                : 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                                                                                    }`}
                                                                                                    style={orderBarPcp}
                                                                                                >
                                                                                                    {!order.maxPcpObj && (
                                                                                                        <span className="text-[7px] text-slate-500 font-bold truncate px-1">Sem Previsão PCP</span>
                                                                                                    )}

                                                                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                                            <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-slate-300">Sem Previsão PCP (Total)</div>
                                                                                                            <div className="text-slate-300 mt-1">Nenhum item deste pedido possui cronograma PCP. Usando prazo comercial como referência.</div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>

                                                                        {/* ITEMS UNDER ORDER */}
                                                                        {isOrderOpen && order.items.map((item, itemIdx) => {
                                                                            const barCom = getBarStyles(item.c5_emissao_raw, item.c6_entreg_raw, false);
                                                                            const barPcp = getBarStyles(item.c5_emissao_raw, item.data_entrega_pcp, true, item.c6_entreg_raw);
                                                                            
                                                                            const deliveryDateObj = parseDateObjGlobal(item.c6_entreg_raw);
                                                                            const pcpDateObj = parsePcpDateObjGlobal(item.data_entrega_pcp);
                                                                            const isPcpDelayed = pcpDateObj && deliveryDateObj && pcpDateObj > deliveryDateObj;
                                                                            const hasPcpDate = !!item.data_entrega_pcp;
                                                                            const displayPcpDateStr = hasPcpDate 
                                                                                ? new Date(item.data_entrega_pcp).toLocaleDateString('pt-BR') 
                                                                                : (deliveryDateObj ? deliveryDateObj.toLocaleDateString('pt-BR') : 'N/A');

                                                                            return (
                                                                                <div key={`${item.pedido}_${item.item}_${itemIdx}`} className="flex hover:bg-slate-50 transition-colors">
                                                                                    <div className="w-[320px] p-3 pl-14 border-r border-slate-200 bg-white sticky left-0 z-10 flex flex-col justify-center shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                                                        <div className="flex items-center justify-between gap-1">
                                                                                            <span className="font-semibold text-slate-700 text-xs truncate max-w-[170px]" title={item.codigo}>{item.codigo}</span>
                                                                                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 border px-1.5 py-0.5 rounded">item {item.item}</span>
                                                                                        </div>
                                                                                        <div className="text-[10px] text-slate-400 truncate max-w-[240px] mt-0.5" title={item.descricao}>{item.descricao}</div>
                                                                                        <div className="flex justify-between items-center text-[10px] mt-1 text-slate-500">
                                                                                            <span>Saldo: <strong>{parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs</strong></span>
                                                                                            <span className="text-[9px] text-indigo-600 font-semibold">{formatBRL(item.valor_saldo)}</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* GANTT TIMELINE LINE CELL */}
                                                                                    <div className="flex relative items-center bg-white" style={{ width: `${weeksList.length * 100}px`, height: '56px' }}>
                                                                                        {/* Background week columns grid */}
                                                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                                                            {weeksList.map((_, idx) => (
                                                                                                <div key={idx} className="h-full border-r border-slate-100" style={{ width: '100px' }} />
                                                                                            ))}
                                                                                        </div>

                                                                                        {/* GANTT BARS CONTAINER */}
                                                                                        <div className="w-full h-full relative flex flex-col justify-center gap-1.5 py-1">
                                                                                            {/* Commercial Bar */}
                                                                                            {barCom && (
                                                                                                <div 
                                                                                                    className="absolute h-3 bg-blue-500/10 border border-blue-400 rounded shadow-sm flex items-center justify-center top-[10px] select-none hover:bg-blue-500/25 transition-all group/bar pointer-events-auto cursor-help"
                                                                                                    style={barCom}
                                                                                                >
                                                                                                    <span className="text-[8px] text-blue-700 font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">COM: {item.entrega_formatada}</span>
                                                                                                    
                                                                                                    {/* Tooltip */}
                                                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                                        <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-blue-300">Prazo Comercial (Protheus)</div>
                                                                                                        <div>📦 <strong>Item:</strong> {item.codigo}</div>
                                                                                                        <div>📊 <strong>Saldo:</strong> {parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs</div>
                                                                                                        <div>📅 <strong>Emissão:</strong> {item.emissao_formatada}</div>
                                                                                                        <div>📅 <strong>Entrega Contratual:</strong> {item.entrega_formatada}</div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* PCP Planned Bar */}
                                                                                            {barPcp ? (
                                                                                                <div 
                                                                                                    className={`absolute h-3 rounded shadow-sm flex items-center justify-center bottom-[10px] border select-none hover:brightness-95 transition-all group/bar pointer-events-auto cursor-help ${
                                                                                                        !hasPcpDate
                                                                                                            ? 'bg-emerald-50/70 border-dashed border-emerald-400/80 text-emerald-800'
                                                                                                            : isPcpDelayed 
                                                                                                                ? 'bg-amber-100 border-amber-400 text-amber-800' 
                                                                                                                : 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                                                                                    }`}
                                                                                                    style={barPcp}
                                                                                                >
                                                                                                    <span className="text-[8px] font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                                                                                        {hasPcpDate ? `PCP: ${displayPcpDateStr}` : `PCP (Comercial): ${displayPcpDateStr}`}
                                                                                                    </span>
                                                                                                    
                                                                                                    {/* Tooltip */}
                                                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-56 leading-relaxed flex flex-col gap-1">
                                                                                                        <div className={`font-bold border-b border-slate-700 pb-1 mb-1 text-xs ${!hasPcpDate ? 'text-emerald-300' : isPcpDelayed ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                                                            {hasPcpDate ? 'Previsão de Entrega (PCP)' : 'Previsão PCP (Prazo Comercial)'}
                                                                                                        </div>
                                                                                                        <div>📦 <strong>Item:</strong> {item.codigo}</div>
                                                                                                        <div>📊 <strong>Saldo:</strong> {parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs</div>
                                                                                                        <div>📅 <strong>Emissão:</strong> {item.emissao_formatada}</div>
                                                                                                        <div>📅 <strong>Previsão PCP:</strong> {displayPcpDateStr} {!hasPcpDate && '(Fallback)'}</div>
                                                                                                        {hasPcpDate && isPcpDelayed && (
                                                                                                            <div className="text-amber-400 font-bold mt-1">⚠️ Desvio de prazo do cronograma!</div>
                                                                                                        )}
                                                                                                        {!hasPcpDate && (
                                                                                                            <div className="text-slate-300 text-[10px] mt-1 italic">Sem previsão formal do PCP. Usando data comercial.</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : (
                                                                                                /* Dotted fallback if PCP is not scheduled */
                                                                                                barCom && (
                                                                                                    <div 
                                                                                                        className="absolute h-3 border border-dashed border-slate-400 rounded bottom-[10px] flex items-center justify-center select-none hover:border-slate-500 bg-slate-50/50 group/bar pointer-events-auto cursor-help"
                                                                                                        style={barCom}
                                                                                                    >
                                                                                                        <span className="text-[7px] text-slate-500 font-bold truncate px-1">Sem Previsão PCP</span>
                                                                                                        
                                                                                                        {/* Tooltip */}
                                                                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                                            <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-slate-300">Programação Ausente</div>
                                                                                                            <div className="text-slate-300 mt-1">Este item ainda não possui previsão de entrega agendada pelo PCP.</div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : (
                                                // RENDER ORDER GROUP MODE
                                                ganttData.map(order => {
                                                    const isOrderOpen = expandedGantt[order.key];
                                                    return (
                                                        <React.Fragment key={order.key}>
                                                            {/* ORDER LEVEL ROW */}
                                                            <div className="flex hover:bg-slate-50/40 transition-colors group">
                                                                <div 
                                                                    onClick={() => toggleGanttNode(order.key)}
                                                                    className="w-[320px] p-3 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-center gap-2 cursor-pointer shadow-[2px_0_5px_rgba(0,0,0,0.02)] select-none"
                                                                >
                                                                    <div className="text-slate-400">{isOrderOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                                                                    <div className="truncate flex-1">
                                                                        <div className="font-bold text-slate-800 text-xs truncate flex items-center gap-1.5">
                                                                            <span>Pedido: {order.pedido}</span>
                                                                            {order.evolutionPct > 0 && (
                                                                                <span className="text-[9px] bg-emerald-100 border border-emerald-300 text-emerald-800 px-1 rounded-full font-bold">
                                                                                    {order.evolutionPct.toFixed(0)}%
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 truncate" title={order.nome_cliente}>{order.nome_cliente}</div>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0 text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                                                        {order.totalQtd.toLocaleString('pt-BR')} pçs
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="flex relative items-center bg-slate-50/20" style={{ width: `${weeksList.length * 100}px`, height: '56px' }}>
                                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                                        {weeksList.map((_, idx) => (
                                                                            <div key={idx} className="h-full border-r border-slate-100/70" style={{ width: '100px' }} />
                                                                        ))}
                                                                    </div>

                                                                    {/* Consolidated Gantt Bars for the Order */}
                                                                    {(() => {
                                                                        const orderBarCom = getBarStyles(order.minEmissionObj, order.maxDeliveryObj, false);
                                                                        const orderBarPcp = getBarStyles(order.minEmissionObj, order.maxPcpObj, true);
                                                                        const isOrderPcpDelayed = order.maxPcpObj && order.maxDeliveryObj && order.maxPcpObj > order.maxDeliveryObj;
                                                                        
                                                                        return (
                                                                            <div className="w-full h-full relative flex flex-col justify-center gap-1.5 py-1 pointer-events-none">
                                                                                {orderBarCom && (
                                                                                    <div 
                                                                                        className="absolute h-3 bg-blue-500/15 border border-blue-400 rounded shadow-sm flex items-center justify-center top-[10px] select-none hover:bg-blue-500/30 transition-all group/bar pointer-events-auto cursor-help"
                                                                                        style={orderBarCom}
                                                                                    >
                                                                                        <span className="text-[7px] text-blue-700 font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">COM: {order.minEmissionObj?.toLocaleDateString('pt-BR')} - {order.maxDeliveryObj?.toLocaleDateString('pt-BR')}</span>
                                                                                        
                                                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                            <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-blue-300">Prazo Comercial (Total Pedido)</div>
                                                                                            <div>📦 <strong>Pedido:</strong> {order.pedido}</div>
                                                                                            <div>📊 <strong>Saldo:</strong> {order.totalQtd.toLocaleString('pt-BR')} pçs</div>
                                                                                            <div>📅 <strong>Início:</strong> {order.minEmissionObj?.toLocaleDateString('pt-BR')}</div>
                                                                                            <div>📅 <strong>Entrega:</strong> {order.maxDeliveryObj?.toLocaleDateString('pt-BR')}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {orderBarPcp ? (
                                                                                    <div 
                                                                                        className={`absolute h-3 rounded shadow-sm flex items-center justify-center bottom-[10px] border select-none hover:brightness-95 transition-all group/bar pointer-events-auto cursor-help ${
                                                                                            isOrderPcpDelayed 
                                                                                                ? 'bg-amber-100 border-amber-400 text-amber-800' 
                                                                                                : 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                                                                        }`}
                                                                                        style={orderBarPcp}
                                                                                    >
                                                                                        <span className="text-[7px] font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">PCP: {order.maxPcpObj?.toLocaleDateString('pt-BR')}</span>
                                                                                        
                                                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-56 leading-relaxed flex flex-col gap-1">
                                                                                            <div className={`font-bold border-b border-slate-700 pb-1 mb-1 text-xs ${isOrderPcpDelayed ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                                                Previsão PCP (Total Pedido)
                                                                                            </div>
                                                                                            <div>📦 <strong>Pedido:</strong> {order.pedido}</div>
                                                                                            <div>📊 <strong>Saldo:</strong> {order.totalQtd.toLocaleString('pt-BR')} pçs</div>
                                                                                            <div>📅 <strong>Previsão PCP:</strong> {order.maxPcpObj?.toLocaleDateString('pt-BR')}</div>
                                                                                            {isOrderPcpDelayed && (
                                                                                                <div className="text-amber-400 font-bold mt-1">⚠️ Desvio de prazo do cronograma!</div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    orderBarCom && (
                                                                                        <div 
                                                                                            className="absolute h-3 border border-dashed border-slate-400 rounded bottom-[10px] flex items-center justify-center select-none hover:border-slate-500 bg-slate-50/50 group/bar pointer-events-auto cursor-help"
                                                                                            style={orderBarCom}
                                                                                        >
                                                                                            <span className="text-[7px] text-slate-500 font-bold truncate px-1">Sem Previsão PCP</span>
                                                                                            
                                                                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                                <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-slate-300">Sem Previsão PCP (Total)</div>
                                                                                                <div className="text-slate-300 mt-1">Nenhum item deste pedido possui cronograma PCP. Usando prazo comercial como referência.</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>

                                                            {/* ITEMS UNDER ORDER */}
                                                            {isOrderOpen && order.items.map((item, itemIdx) => {
                                                                const barCom = getBarStyles(item.c5_emissao_raw, item.c6_entreg_raw, false);
                                                                const barPcp = getBarStyles(item.c5_emissao_raw, item.data_entrega_pcp, true, item.c6_entreg_raw);
                                                                
                                                                const deliveryDateObj = parseDateObjGlobal(item.c6_entreg_raw);
                                                                const pcpDateObj = parsePcpDateObjGlobal(item.data_entrega_pcp);
                                                                const isPcpDelayed = pcpDateObj && deliveryDateObj && pcpDateObj > deliveryDateObj;
                                                                const hasPcpDate = !!item.data_entrega_pcp;
                                                                const displayPcpDateStr = hasPcpDate 
                                                                    ? new Date(item.data_entrega_pcp).toLocaleDateString('pt-BR') 
                                                                    : (deliveryDateObj ? deliveryDateObj.toLocaleDateString('pt-BR') : 'N/A');

                                                                return (
                                                                    <div key={`${item.pedido}_${item.item}_${itemIdx}`} className="flex hover:bg-slate-50 transition-colors">
                                                                        <div className="w-[320px] p-3 pl-8 border-r border-slate-200 bg-white sticky left-0 z-10 flex flex-col justify-center shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                                            <div className="flex items-center justify-between gap-1">
                                                                                <span className="font-semibold text-slate-700 text-xs truncate max-w-[170px]" title={item.codigo}>{item.codigo}</span>
                                                                                <span className="text-[10px] text-slate-500 font-bold bg-slate-100 border px-1.5 py-0.5 rounded">item {item.item}</span>
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-400 truncate max-w-[240px] mt-0.5" title={item.descricao}>{item.descricao}</div>
                                                                            <div className="flex justify-between items-center text-[10px] mt-1 text-slate-500">
                                                                                <span>Saldo: <strong>{parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs</strong></span>
                                                                                <span className="text-[9px] text-indigo-600 font-semibold">{formatBRL(item.valor_saldo)}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex relative items-center bg-white" style={{ width: `${weeksList.length * 100}px`, height: '56px' }}>
                                                                            <div className="absolute inset-0 flex pointer-events-none">
                                                                                {weeksList.map((_, idx) => (
                                                                                    <div key={idx} className="h-full border-r border-slate-100" style={{ width: '100px' }} />
                                                                                ))}
                                                                            </div>

                                                                            <div className="w-full h-full relative flex flex-col justify-center gap-1.5 py-1">
                                                                                {barCom && (
                                                                                    <div 
                                                                                        className="absolute h-3 bg-blue-500/10 border border-blue-400 rounded shadow-sm flex items-center justify-center top-[10px] select-none hover:bg-blue-500/25 transition-all group/bar pointer-events-auto cursor-help"
                                                                                        style={barCom}
                                                                                    >
                                                                                        <span className="text-[8px] text-blue-700 font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">COM: {item.entrega_formatada}</span>
                                                                                        
                                                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                            <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-blue-300">Prazo Comercial (Protheus)</div>
                                                                                            <div>📦 <strong>Item:</strong> {item.codigo}</div>
                                                                                            <div>📊 <strong>Saldo:</strong> {parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs</div>
                                                                                            <div>📅 <strong>Emissão:</strong> {item.emissao_formatada}</div>
                                                                                            <div>📅 <strong>Entrega Contratual:</strong> {item.entrega_formatada}</div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {barPcp ? (
                                                                                    <div 
                                                                                        className={`absolute h-3 rounded shadow-sm flex items-center justify-center bottom-[10px] border select-none hover:brightness-95 transition-all group/bar pointer-events-auto cursor-help ${
                                                                                            !hasPcpDate
                                                                                                ? 'bg-emerald-50/70 border-dashed border-emerald-400/80 text-emerald-800'
                                                                                                : isPcpDelayed 
                                                                                                    ? 'bg-amber-100 border-amber-400 text-amber-800' 
                                                                                                    : 'bg-emerald-100 border-emerald-400 text-emerald-800'
                                                                                        }`}
                                                                                        style={barPcp}
                                                                                    >
                                                                                        <span className="text-[8px] font-bold truncate px-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                                                                            {hasPcpDate ? `PCP: ${displayPcpDateStr}` : `PCP (Comercial): ${displayPcpDateStr}`}
                                                                                        </span>
                                                                                        
                                                                                        {/* Tooltip */}
                                                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-56 leading-relaxed flex flex-col gap-1">
                                                                                            <div className={`font-bold border-b border-slate-700 pb-1 mb-1 text-xs ${!hasPcpDate ? 'text-emerald-300' : isPcpDelayed ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                                                {hasPcpDate ? 'Previsão de Entrega (PCP)' : 'Previsão PCP (Prazo Comercial)'}
                                                                                            </div>
                                                                                            <div>📦 <strong>Item:</strong> {item.codigo}</div>
                                                                                            <div>📊 <strong>Saldo:</strong> {parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs</div>
                                                                                            <div>📅 <strong>Emissão:</strong> {item.emissao_formatada}</div>
                                                                                            <div>📅 <strong>Previsão PCP:</strong> {displayPcpDateStr} {!hasPcpDate && '(Fallback)'}</div>
                                                                                            {hasPcpDate && isPcpDelayed && (
                                                                                                <div className="text-amber-400 font-bold mt-1">⚠️ Desvio de prazo do cronograma!</div>
                                                                                            )}
                                                                                            {!hasPcpDate && (
                                                                                                <div className="text-slate-300 text-[10px] mt-1 italic">Sem previsão formal do PCP. Usando data comercial.</div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    barCom && (
                                                                                        <div 
                                                                                            className="absolute h-3 border border-dashed border-slate-400 rounded bottom-[10px] flex items-center justify-center select-none hover:border-slate-500 bg-slate-50/50 group/bar pointer-events-auto cursor-help"
                                                                                            style={barCom}
                                                                                        >
                                                                                            <span className="text-[7px] text-slate-500 font-bold truncate px-1">Sem Previsão PCP</span>
                                                                                            
                                                                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-800 text-white text-[11px] p-2.5 rounded-lg shadow-xl z-50 pointer-events-none w-52 leading-relaxed">
                                                                                                <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-xs text-slate-300">Programação Ausente</div>
                                                                                                <div className="text-slate-300 mt-1">Este item ainda não possui previsão de entrega agendada pelo PCP.</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 shadow-sm bg-slate-50">
                                    <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                                        <th className="p-3 pl-4 font-semibold w-12 bg-slate-50">Exp.</th>
                                        <th className="p-3 font-semibold bg-slate-50">Agrupamento (Quinzena / Produto / Pedido)</th>
                                        <th className="p-3 font-semibold text-center bg-slate-50">Data Entrada</th>
                                        <th className="p-3 font-semibold text-center bg-slate-50">Data Entrega</th>
                                        <th className="p-3 font-semibold text-center text-emerald-600 bg-slate-50">Data PCP</th>
                                        <th className="p-3 font-semibold text-right bg-slate-50">Qtd</th>
                                        {isShowingFinance && <th className="p-3 font-semibold text-right text-indigo-600 bg-slate-50">Valor (R$)</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {isShowingFinance ? (
                                        <tr className="bg-white"><td colSpan={10} className="p-8 text-center text-slate-500"><DollarSign className="w-12 h-12 text-slate-200 mx-auto mb-2" />A aba financeira exibe os gráficos R$ e totais monetários no painel acima.</td></tr>
                                    ) : currentTree.length === 0 ? (
                                        <tr className="bg-white"><td colSpan={10} className="p-4 text-center text-slate-400">Nenhum dado encontrado com o filtro atual na aba {activeTab}.</td></tr>
                                    ) : (
                                        currentTree.map(grp => {
                                            const isGrpOpen = expandedGroups[grp.groupKey];
                                            return (
                                                <React.Fragment key={grp.groupKey}>
                                                    {/* ROW 1: QUINZENA */}
                                                    <tr 
                                                        onClick={() => toggleGroup(grp.groupKey)}
                                                        className="bg-white border-b border-slate-100 hover:bg-slate-50 cursor-pointer group transition-colors"
                                                    >
                                                        <td className="p-3 pl-4 text-slate-400">{isGrpOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</td>
                                                        <td className="p-3 font-bold text-slate-800" colSpan={4}>
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs mr-2 border border-slate-200">Período</span>
                                                            {grp.groupKey}
                                                        </td>
                                                        <td className="p-3 text-right font-bold text-slate-800">
                                                            {grp.totalQtd.toLocaleString('pt-BR')} pçs
                                                        </td>
                                                        {isShowingFinance && <td className="p-3 text-right font-bold text-indigo-700">{formatBRL(grp.totalBrl)}</td>}
                                                    </tr>

                                                    {/* PRODUCTS INSIDE QUINZENA */}
                                                    {isGrpOpen && Object.values(grp.products).map(prd => {
                                                        const productUniqueKey = `${grp.groupKey}_${prd.prodKey}`;
                                                        const isPrdOpen = expandedProducts[productUniqueKey];
                                                        return (
                                                            <React.Fragment key={productUniqueKey}>
                                                                <tr 
                                                                    onClick={() => toggleProduct(productUniqueKey)}
                                                                    className="bg-slate-50/50 border-b border-slate-100 hover:bg-slate-100 cursor-pointer"
                                                                >
                                                                    <td className="p-3 pl-8 text-indigo-500 border-l-[3px] border-l-indigo-500">
                                                                        {isPrdOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                    </td>
                                                                    <td className="p-2 font-semibold text-indigo-900 text-sm" colSpan={4}>
                                                                        <div className="flex items-center gap-2">
                                                                            <Package size={14} className="text-indigo-500" />
                                                                            {prd.prodKey}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2 text-right text-sm font-semibold text-slate-700">
                                                                        {prd.totalQtd.toLocaleString('pt-BR')} pçs
                                                                    </td>
                                                                    {isShowingFinance && <td className="p-2 text-right text-sm text-indigo-600">{formatBRL(prd.totalBrl)}</td>}
                                                                </tr>

                                                                {/* ITEMS (CLIENTS/ORDERS) INSIDE PRODUCT */}
                                                                {isPrdOpen && prd.items.map((item, idx) => {
                                                                    let badgeBg = 'bg-slate-100 text-slate-600 border-slate-200';
                                                                    const diasAtraso = parseInt(item.dias_atraso || 0, 10);
                                                                    if (diasAtraso > 15) badgeBg = 'bg-red-100 text-red-700 border-red-200';
                                                                    else if (diasAtraso > 0) badgeBg = 'bg-orange-100 text-orange-700 border-orange-200';
                                                                    else if (diasAtraso >= -7 && diasAtraso <= 0) badgeBg = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                                                                    else badgeBg = 'bg-emerald-100 text-emerald-700 border-emerald-200';

                                                                    const heatmapText = diasAtraso > 0 ? `Atraso de ${diasAtraso}d` : (diasAtraso === 0 ? 'Para Hoje' : `Faltam ${Math.abs(diasAtraso)}d`);

                                                                    return (
                                                                        <tr key={`${item.pedido}-${item.item}-${idx}`} className="bg-white hover:bg-slate-50 transition-colors border-b border-slate-100">
                                                                            <td></td>
                                                                            <td className="p-2 pl-12 text-sm text-slate-600">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-medium text-slate-700">{item.nome_cliente || item.cod_cliente}</span>
                                                                                        <span className="text-slate-400 text-xs tracking-wide">(Ped: {item.pedido})</span>
                                                                                    </div>
                                                                                    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${badgeBg}`}>
                                                                                        {heatmapText}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="p-2 text-sm text-center text-slate-400">
                                                                                {item.emissao_formatada}
                                                                            </td>
                                                                            <td className="p-2 text-sm text-center text-slate-700 font-semibold">
                                                                                {item.entrega_formatada}
                                                                            </td>
                                                                            <td className="p-2 text-sm text-center font-bold">
                                                                                {item.data_entrega_pcp ? (
                                                                                    <span className="text-emerald-600">{new Date(item.data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                                                                ) : (
                                                                                    <span className="text-slate-300 font-normal">--</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-2 text-sm text-right text-slate-600">
                                                                                {parseFloat(item.qtd_faturar).toLocaleString('pt-BR')} pçs
                                                                            </td>
                                                                            {isShowingFinance && <td className="p-2 text-sm text-right">{formatBRL(item.valor_saldo)}</td>}
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisaoGerencialProdutos;
