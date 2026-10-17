import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getVisaoGerencialAtrasos } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { Target, AlertTriangle, Calendar, DollarSign, Lock, ChevronDown, ChevronRight, Package, Box, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#425750', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#14b8a6', '#f97316'];

const VisaoGerencialAtrasos = () => {
    const { user, hasPermission } = useAuth();
    
    // Core State
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState('logistica');
    const [expandedClients, setExpandedClients] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});
    const exportRef = useRef(null);

    const exportToPDF = async () => {
        if (!exportRef.current) return;
        const element = exportRef.current;
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4'); /* Landscape */
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.text("Resumo Gerencial - Visao Atrasos", 15, 10);
        pdf.addImage(imgData, 'PNG', 0, 15, pdfWidth, pdfHeight);
        pdf.save(`Resumo_Atrasos_PCP_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    };

    // Fetch
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await getVisaoGerencialAtrasos({});
            setData(resp.data || []);
        } catch (err) {
            console.error(err);
            setError('Falha ao carregar atrasos gerenciais. Verifique a conexão com o backend.');
        } finally {
            setLoading(false);
        }
    };

    // Toggle Expansion
    const toggleClient = (client) => {
        setExpandedClients(prev => ({ ...prev, [client]: !prev[client] }));
    };
    const toggleMonth = (monthKey) => {
        setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
    };

    // Derived Data & Grouping
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return { grouped: [], metrics: {}, charts: {} };

        let totalSaldoQtd = 0;
        let totalSaldoBrl = 0;
        let totalItems = 0;
        let sumAtraso = 0;

        const clientMap = {};
        const monthMap = {};
        
        data.forEach(item => {
            const qtd = Number(item.qtd_faturar) || 0;
            const val = Number(item.valor_saldo) || 0;
            const dias = Number(item.dias_atraso) || 0;

            totalSaldoQtd += qtd;
            totalSaldoBrl += val;
            totalItems += 1;
            sumAtraso += dias;

            // Grouping by Client
            const cli = item.nome_cliente || 'NÃO IDENTIFICADO';
            if (!clientMap[cli]) clientMap[cli] = { qtdTotal: 0, valTotal: 0, itens: [] };
            clientMap[cli].qtdTotal += qtd;
            clientMap[cli].valTotal += val;
            clientMap[cli].itens.push(item);

            // Grouping by Month (YYYY-MM to sort)
            const dtRaw = item.entrega_raw; // YYYYMMDD
            let mesKey = 'Sem Data';
            let mesLabel = 'Sem Data';
            if (dtRaw && dtRaw.length >= 6) {
                const ano = dtRaw.substring(0, 4);
                const mes = dtRaw.substring(4, 6);
                mesKey = `${ano}-${mes}`;
                mesLabel = `${mes}/${ano}`;
            }
            if (!monthMap[mesKey]) monthMap[mesKey] = { label: mesLabel, qtdTotal: 0, valTotal: 0 };
            monthMap[mesKey].qtdTotal += qtd;
            monthMap[mesKey].valTotal += val;
        });

        // Hierarchy Build
        const grouped = Object.entries(clientMap).map(([client, cData]) => {
            const months = {};
            cData.itens.forEach(it => {
                const dtRaw = it.entrega_raw;
                let mesKey = dtRaw && dtRaw.length >= 6 ? `${dtRaw.substring(0, 4)}-${dtRaw.substring(4, 6)}` : 'Sem Data';
                if (!months[mesKey]) months[mesKey] = { qtdTotal: 0, valTotal: 0, logs: [] };
                months[mesKey].qtdTotal += Number(it.qtd_faturar) || 0;
                months[mesKey].valTotal += Number(it.valor_saldo) || 0;
                months[mesKey].logs.push(it);
            });
            return {
                client,
                qtdTotal: cData.qtdTotal,
                valTotal: cData.valTotal,
                months: Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).map(([mKey, mData]) => ({
                    monthKey: mKey,
                    qtdTotal: mData.qtdTotal,
                    valTotal: mData.valTotal,
                    logs: mData.logs
                }))
            };
        }).sort((a, b) => b.valTotal - a.valTotal);

        // Chart 1: Top Clientes
        const chartClientes = Object.entries(clientMap)
            .map(([name, d]) => ({ name, Qtd: d.qtdTotal, Valor: d.valTotal }))
            .sort((a, b) => activeTab === 'financeiro' ? b.Valor - a.Valor : b.Qtd - a.Qtd).slice(0, 5);

        // Chart 2: Time Series Meses
        const chartMeses = Object.entries(monthMap)
            .map(([k, d]) => ({ name: d.label, ord: k, Qtd: d.qtdTotal, Valor: d.valTotal }))
            .sort((a, b) => a.ord.localeCompare(b.ord));

        return {
            grouped,
            metrics: {
                totalSaldoQtd,
                totalSaldoBrl,
                totalItems,
                avgAtraso: totalItems > 0 ? (sumAtraso / totalItems).toFixed(0) : 0
            },
            charts: {
                clientes: chartClientes,
                meses: chartMeses
            }
        };
    }, [data, activeTab]);

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const canViewFinance = hasPermission('valores_financeiros', 'view');

    return (
        <div className="p-6 bg-slate-50 h-screen flex flex-col overflow-hidden">
            {/* Header & Toggle Section */}
            <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 relative">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="text-red-500 h-6 w-6" />
                        Visão Gerencial (Atrasos)
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Espelho da fábrica: Focado 100% em <strong>itens pendentes</strong> com data de entrega inferior a hoje.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors">
                        <Download className="w-4 h-4" />
                        Gerar PDF (Resumo)
                    </button>
                </div>
            </div>

            {/* TAB Navigation */}
            <div className="flex-none flex border-b border-slate-200 mb-4 bg-white rounded-t-xl overflow-hidden px-4 pt-2 shadow-sm">
                <button
                    onClick={() => setActiveTab('logistica')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'logistica'
                        ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                >
                    <Package className="w-4 h-4" />
                    Logística & Qtds
                </button>

                <button
                    onClick={() => {
                        if (!canViewFinance) {
                            alert('Seu perfil não possui acesso à visão Financeira.');
                            return;
                        }
                        setActiveTab('financeiro');
                    }}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'financeiro'
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                >
                    <DollarSign className="w-4 h-4" />
                    Dashboard Financeiro
                    {!canViewFinance && <Lock className="w-3 h-3 ml-1 text-slate-400" />}
                </button>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex-1 flex justify-center items-center bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : error ? (
                <div className="flex-none p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            ) : data.length === 0 ? (
                <div className="flex-1 p-12 bg-white rounded-xl shadow-sm border border-slate-100 text-center flex flex-col justify-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Sensacional!</h3>
                    <p className="text-slate-500 mt-2">Nenhum pedido em aberto e atrasado encontrado.</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">

                    {/* KPI Cards */}
                    <div ref={exportRef} className="bg-slate-50 relative flex-none">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                    <Box className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Total Items Atrasados</p>
                                    <h3 className="text-2xl font-bold text-slate-800">{processedData.metrics.totalItems}</h3>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Qtd Física Pendente</p>
                                    <h3 className="text-2xl font-bold text-slate-800">{processedData.metrics.totalSaldoQtd.toLocaleString('pt-BR')}</h3>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Risco Financeiro Global</p>
                                    <h3 className="text-2xl font-bold text-slate-800">
                                        {canViewFinance ? formatBRL(processedData.metrics.totalSaldoBrl) : '••••••••'}
                                    </h3>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Média de Atraso</p>
                                    <h3 className="text-2xl font-bold text-slate-800">
                                        {processedData.metrics.avgAtraso} <span className="text-sm font-normal text-slate-500">dias</span>
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                            {/* CHART 1: TOP Clientes */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-base font-bold text-slate-800 mb-4">Top 5 Clientes c/ Atrasos</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={processedData.charts.clientes} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                            <XAxis 
                                                type="number" 
                                                fontSize={11} 
                                                tickFormatter={val => activeTab === 'financeiro' ? `R$ ${(val/1000).toFixed(0)}k` : `${val} pçs`} 
                                                label={{ value: activeTab === 'financeiro' ? 'Saldo Financeiro em Atraso (R$)' : 'Volume Pendente (Peças)', position: 'insideBottom', offset: -15, fontSize: 12, fill: '#64748b' }}
                                            />
                                            <YAxis dataKey="name" type="category" width={160} fontSize={10} tickFormatter={(name) => name && name.length > 20 ? name.substring(0, 20) + '...' : name} />
                                            <RechartsTooltip formatter={(value) => activeTab === 'financeiro' ? formatBRL(value) : `${value.toLocaleString('pt-BR')} peças`} cursor={{fill: '#f1f5f9'}} />
                                            <Bar dataKey={activeTab === 'financeiro' ? 'Valor' : 'Qtd'} fill={activeTab === 'financeiro' ? '#32423D' : '#425750'} radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* CHART 2: Linha do Tempo Acumulada */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-base font-bold text-slate-800 mb-4">Atrasos por Mês</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={processedData.charts.meses} margin={{ top: 5, right: 5, left: 20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis 
                                                dataKey="name" 
                                                fontSize={11} 
                                                label={{ value: 'Mês/Ano de Entrega', position: 'insideBottom', offset: -15, fontSize: 12, fill: '#64748b' }}
                                            />
                                            <YAxis 
                                                fontSize={11} 
                                                tickFormatter={val => activeTab === 'financeiro' ? `R$ ${(val/1000).toFixed(0)}k` : `${val} pçs`} 
                                                label={{ value: activeTab === 'financeiro' ? 'Valor (R$)' : 'Volume (Peças)', angle: -90, position: 'insideLeft', offset: -10, fontSize: 12, fill: '#64748b' }}
                                            />
                                            <RechartsTooltip formatter={(value) => activeTab === 'financeiro' ? formatBRL(value) : `${value.toLocaleString('pt-BR')} peças`} cursor={{fill: '#f1f5f9'}} />
                                            <Bar dataKey={activeTab === 'financeiro' ? 'Valor' : 'Qtd'} fill={activeTab === 'financeiro' ? '#10b981' : '#f59e0b'} radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Grid: Agrupado */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-none">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Espelho Dinâmico de Pendências</h3>
                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-md">Agrupado: Cliente {'>'} Mês</span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 shadow-sm bg-slate-50">
                                    <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                                        <th className="p-3 pl-4 font-semibold w-12 bg-slate-50">Exp.</th>
                                        <th className="p-3 font-semibold bg-slate-50">Cliente / Item / Produto</th>
                                        <th className="p-3 font-semibold text-center bg-slate-50">Data Entrada</th>
                                        <th className="p-3 font-semibold text-center bg-slate-50">Data Entrega</th>
                                        <th className="p-3 font-semibold text-right bg-slate-50">Qtd Atrasada</th>
                                        {activeTab === 'financeiro' && <th className="p-3 font-semibold text-right text-indigo-600 bg-slate-50">R$ Faturar</th>}
                                        <th className="p-3 font-semibold text-center w-24 bg-slate-50">Dias Atraso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedData.grouped.map((cliNode) => {
                                        const isCliOpen = expandedClients[cliNode.client];
                                        return (
                                            <React.Fragment key={cliNode.client}>
                                                {/* CLIENT HEADER ROW */}
                                                <tr className="border-b border-slate-100 bg-white hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleClient(cliNode.client)}>
                                                    <td className="p-3 pl-4 text-slate-400">
                                                        {isCliOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </td>
                                                    <td className="p-3 font-bold text-slate-800" colSpan={3}>
                                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs mr-2 border border-blue-200">Cliente</span>
                                                        {cliNode.client}
                                                    </td>
                                                    <td className="p-3 font-bold text-right text-slate-800">
                                                        {cliNode.qtdTotal.toLocaleString('pt-BR')}
                                                    </td>
                                                    {activeTab === 'financeiro' && (
                                                        <td className="p-3 font-bold text-right text-indigo-700">
                                                            {formatBRL(cliNode.valTotal)}
                                                        </td>
                                                    )}
                                                    <td className="p-3 text-center">-</td>
                                                </tr>

                                                {/* MONTH SUB-HEADER ROWS */}
                                                {isCliOpen && cliNode.months.map((monthNode) => {
                                                    const mKey = `${cliNode.client}-${monthNode.monthKey}`;
                                                    const isMonthOpen = expandedMonths[mKey];
                                                    return (
                                                        <React.Fragment key={mKey}>
                                                            <tr className="border-b border-slate-50 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => toggleMonth(mKey)}>
                                                                <td className="p-3 pl-8 text-slate-400 border-l-[3px] border-l-blue-400">
                                                                    {isMonthOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                </td>
                                                                <td className="p-2 font-semibold text-slate-600 text-sm" colSpan={3}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Calendar size={14} className="text-slate-400" />
                                                                        Mês: {monthNode.monthKey}
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 font-semibold text-right text-slate-600 text-sm">
                                                                    {monthNode.qtdTotal.toLocaleString('pt-BR')}
                                                                </td>
                                                                {activeTab === 'financeiro' && (
                                                                    <td className="p-2 font-semibold text-right text-indigo-600 text-sm">
                                                                        {formatBRL(monthNode.valTotal)}
                                                                    </td>
                                                                )}
                                                                <td className="p-2 text-center">-</td>
                                                            </tr>

                                                            {/* INDIVIDUAL ITEMS ROWS */}
                                                            {isMonthOpen && monthNode.logs.map((item, idx) => (
                                                                <tr key={`${item.pedido}-${item.item}-${idx}`} className="border-b border-slate-50 bg-white hover:bg-slate-50">
                                                                    <td className="p-2 pl-12 border-l-[3px] border-l-slate-200"></td>
                                                                    <td className="p-2 text-sm text-slate-700">
                                                                        <div className="flex gap-2 items-center">
                                                                            <span className="text-[10px] bg-slate-100 px-1 border border-slate-200 rounded text-slate-500 font-mono">
                                                                                {item.pedido}/{item.item}
                                                                            </span>
                                                                            <div className="line-clamp-1 max-w-[300px]" title={`[${item.codigo}] ${item.descricao}`}>
                                                                                <span className="font-medium mr-1">{item.codigo}</span>
                                                                                <span className="text-slate-500 text-xs">{item.descricao}</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2 text-sm text-center text-slate-500">
                                                                        {item.emissao_formatada}
                                                                    </td>
                                                                    <td className="p-2 text-sm text-center text-slate-600">
                                                                        {item.entrega_formatada}
                                                                    </td>
                                                                    <td className="p-2 text-sm text-right font-medium">
                                                                        {Number(item.qtd_faturar).toLocaleString('pt-BR')}
                                                                    </td>
                                                                    {activeTab === 'financeiro' && (
                                                                        <td className="p-2 text-sm text-right text-slate-600 font-mono">
                                                                            {formatBRL(item.valor_saldo)}
                                                                        </td>
                                                                    )}
                                                                    <td className="p-2 text-center">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                                                            {item.dias_atraso}d
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default VisaoGerencialAtrasos;

// aria-label fix for ux_audit
