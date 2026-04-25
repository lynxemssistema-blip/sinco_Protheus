import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getVisaoGerencialFabrica, saveSnapshotFabrica, getKpiFaturar } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { Factory, Calendar, DollarSign, Lock, ChevronDown, ChevronRight, Package, Download, Camera, CheckSquare, Clock, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

    const canViewFinance = user?.tipo === 'A' || hasPermission('financeiro', 'view');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [resp, kpiResp] = await Promise.all([
                getVisaoGerencialFabrica({}),
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


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-slate-500">Mapeando a fábrica. Aguarde...</p>
            </div>
        );
    }

    if (error) {
        return <div className="p-6 text-red-500 bg-red-50 border border-red-200 rounded-lg m-6">{error}</div>;
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
                             <h4 className="text-xl font-bold text-slate-800">{processedData.metrics.atraso.qtd.toLocaleString()} <span className="text-xs font-normal text-slate-500">pçs</span></h4>
                             {canViewFinance && <div className="text-xs text-red-600 font-semibold mt-1">R$ {(processedData.metrics.atraso.brl / 1000).toFixed(0)}k</div>}
                         </div>
                    </div>
                    
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 xl:col-span-1">
                         <div className="flex items-center justify-between">
                             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckSquare size={20} /></div>
                             <span className="text-[10px] font-bold text-slate-400 uppercase">No Prazo</span>
                         </div>
                         <div className="mt-4">
                             <h4 className="text-xl font-bold text-slate-800">{processedData.metrics.futuro.qtd.toLocaleString()} <span className="text-xs font-normal text-slate-500">pçs</span></h4>
                             {canViewFinance && <div className="text-xs text-emerald-600 font-semibold mt-1">R$ {(processedData.metrics.futuro.brl / 1000).toFixed(0)}k</div>}
                         </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm xl:col-span-2">
                        <h4 className="text-sm font-bold text-slate-600 mb-3">Distribuição de Carga</h4>
                        <div className="h-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processedData.chartData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={90} fontSize={10} tick={{fill: '#64748b'}} />
                                    <RechartsTooltip formatter={(val) => Math.floor(val).toLocaleString() + (isShowingFinance ? ' R$' : ' pçs')} />
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
                                <ResponsiveContainer width="100%" height="100%">
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
                                                else if (name.includes('Novo')) color = '#8b5cf6';
                                                else if (name === 'PCP (Com OP)') color = '#3b82f6';
                                                else if (name.includes('Sem OP')) color = '#f97316';
                                                return <Cell key={`pie-cell-${index}`} fill={color} />;
                                            })}
                                        </Pie>
                                        <RechartsTooltip formatter={(val, name) => [`${Number(val).toLocaleString()} itens`, name]} />
                                        <Legend
                                            verticalAlign="middle"
                                            align="right"
                                            layout="vertical"
                                            iconSize={8}
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '4px' }}
                                            formatter={(value, entry) => `${value}: ${Number(entry.payload.total).toLocaleString()}`}
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

                    {/* Table View */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 shadow-sm bg-slate-50">
                                <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                                    <th className="p-3 pl-4 font-semibold w-12 bg-slate-50">Exp.</th>
                                    <th className="p-3 font-semibold bg-slate-50">Agrupamento (Quinzena / Produto / Pedido)</th>
                                    <th className="p-3 font-semibold text-center bg-slate-50">Data Entrada</th>
                                    <th className="p-3 font-semibold text-center bg-slate-50">Data Entrega</th>
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
                                                    <td className="p-3 font-bold text-slate-800" colSpan={3}>
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs mr-2 border border-slate-200">Período</span>
                                                        {grp.groupKey}
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-slate-800">
                                                        {grp.totalQtd.toLocaleString()} pçs
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
                                                                <td className="p-2 font-semibold text-indigo-900 text-sm" colSpan={3}>
                                                                    <div className="flex items-center gap-2">
                                                                        <Package size={14} className="text-indigo-500" />
                                                                        {prd.prodKey}
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 text-right text-sm font-semibold text-slate-700">
                                                                    {prd.totalQtd.toLocaleString()} pçs
                                                                </td>
                                                                {isShowingFinance && <td className="p-2 text-right text-sm text-indigo-600">{formatBRL(prd.totalBrl)}</td>}
                                                            </tr>

                                                            {/* ITEMS (CLIENTS/ORDERS) INSIDE PRODUCT */}
                                                            {isPrdOpen && prd.items.map((item, idx) => {
                                                                // Heatmap Badge definition
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
                                                                        <td className="p-2 text-sm text-right text-slate-600">
                                                                            {parseFloat(item.qtd_faturar).toLocaleString()} pçs
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisaoGerencialProdutos;
