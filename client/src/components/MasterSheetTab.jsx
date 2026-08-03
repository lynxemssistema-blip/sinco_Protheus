import React, { useState, useEffect, useMemo } from 'react';
import { getSalesPlanningMasterSheet } from '../services/api';
import { exportMasterSheetExcel, exportMasterSheetPdf } from '../services/masterSheetExportGenerator';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Download, Info, Table, Box, List, Settings, Activity, BarChart2, X, ChevronDown, FileText, Loader2, Play } from 'lucide-react';

const getFileUrl = (path) => {
    if (!path) return '';
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const serverUrl = baseUrl.replace('/api', '');
    return `${serverUrl}${path}`;
};

const getTodayDate = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const DrawingIcon = ({ produto }) => {
    const [loading, setLoading] = useState(false);

    const handleClick = async (e) => {
        e.stopPropagation();
        if (loading) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/docs/${produto}`);
            const pdfDoc = data.find(d => 
                (d.tipo === 'Desenho' || (d.titulo && d.titulo.toLowerCase().includes('desenho'))) && 
                d.url_arquivo && d.url_arquivo.toLowerCase().endsWith('.pdf')
            );
            if (pdfDoc) {
                window.open(`/api/docs/view?path=${encodeURIComponent(pdfDoc.url_arquivo)}`, '_blank');
            } else {
                alert(`Nenhum desenho em PDF encontrado para o produto ${produto}.`);
            }
        } catch (err) {
            console.error('Erro ao buscar desenho', err);
            alert(`Erro ao buscar desenho para o produto ${produto}.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleClick}
            className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 focus:outline-none"
            title={`Abrir Desenho: ${produto}`}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <FileText className="w-4 h-4" />}
        </button>
    );
};

const MasterSheetTab = ({ filterParams }) => {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');

    const [baseCalculo, setBaseCalculo] = useState('saldo'); // 'saldo' | 'pedido'
    const [exibirCustos, setExibirCustos] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('MP'); // 'MP' por padrão

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('pedidos');
    const [data0, setData0] = useState(getTodayDate());
    const [simulating, setSimulating] = useState(false);
    const requestSeq = React.useRef(0);

    const loadData = async (simulate = false) => {
        const seq = ++requestSeq.current;
        setLoading(true);
        if (simulate) setSimulating(true);
        setError(null);
            try {
                const cleanParams = {
                    cliente:             filterParams?.cliente,
                    pedido:              filterParams?.pedido,
                    produto:             filterParams?.produto,
                    pedcli:              filterParams?.pedcli,
                    refCliente:          filterParams?.refCliente,
                    dataInicial:         filterParams?.dataInicial,
                    dataFinal:           filterParams?.dataFinal,
                    dateType:            filterParams?.dateType,
                    tipo_item:           filterParams?.tipo_item,
                    op_status:           filterParams?.op_status,
                    only_active:         filterParams?.only_active,
                    somente_prioridades: filterParams?.somente_prioridades,
                    _simulateFCS:        simulate
                };

                // Only send data_0 if explicitly requested via simulation trigger
                if (cleanParams._simulateFCS && data0) {
                    cleanParams.data_0 = data0;
                }
                delete cleanParams._simulateFCS;

                const res = await getSalesPlanningMasterSheet(cleanParams);
                if (seq !== requestSeq.current) return; // Ignora respostas de requests obsoletos (race condition)
                setData(res);
            } catch (err) {
                if (seq !== requestSeq.current) return;
                console.error("Failed to load Master Sheet", err);
                setError(err.response?.data?.error || err.message);
            } finally {
                if (seq === requestSeq.current) {
                    setLoading(false);
                    setSimulating(false);
                }
            }
        };

    useEffect(() => {
        if (!filterParams) return;
        // Debounce para evitar sobrecarga no servidor a cada tecla digitada
        const timeoutId = setTimeout(() => {
            loadData(false); // Do not simulate on initial filter load
        }, 800);
        return () => clearTimeout(timeoutId);
    }, [filterParams]);

    const handleRunSimulation = () => {
        loadData(true);
    };

    const handleExportExcel = () => {
        try {
            exportMasterSheetExcel(data, {
                ...filterParams,
                baseCalculo,
                exibirCustos: canViewValues && exibirCustos,
                filtroTipo
            });
        } catch (err) {
            alert(err.message || 'Erro ao exportar Excel');
        }
    };

    const handleExportPdf = () => {
        try {
            exportMasterSheetPdf(data, activeTab, {
                ...filterParams,
                baseCalculo,
                exibirCustos: canViewValues && exibirCustos
            });
        } catch (err) {
            alert(err.message || 'Erro ao exportar PDF');
        }
    };

    if (loading && !simulating) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] bg-slate-50 border border-slate-200 rounded-lg shadow-inner">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#1E3A5F] mb-4"></div>
                <h3 className="text-[#1E3A5F] font-bold text-lg">Processando Planilha Mestra...</h3>
                <p className="text-slate-500 mt-2 text-sm max-w-md text-center">
                    Aguarde enquanto o sistema calcula as previsões de carga, explode a engenharia e constrói as visões. (Isto pode levar alguns segundos devido ao volume de dados).
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                <h3 className="font-bold mb-2">Erro ao carregar a Planilha Mestra</h3>
                <p>{error}</p>
            </div>
        );
    }

    if (!data) return null;

    const tabs = [
        { id: 'capa', label: 'Capa', icon: <Info className="w-4 h-4" /> },
        { id: 'docs', label: 'Entendendo a Planilha', icon: <Info className="w-4 h-4" /> },
        { id: 'resumo', label: 'Resumo', icon: <Box className="w-4 h-4" /> },
        { id: 'pedidos', label: 'Pedidos', icon: <Table className="w-4 h-4" /> },
        { id: 'itens', label: 'Itens Detalhados', icon: <List className="w-4 h-4" /> },
        { id: 'estruturas', label: 'Estrutura dos Produtos', icon: <List className="w-4 h-4" /> },
        { id: 'materiais_necessarios', label: 'Materiais Necessários', icon: <Box className="w-4 h-4" /> },
        { id: 'carga', label: 'Carga por Recurso', icon: <Settings className="w-4 h-4" /> },
        { id: 'capacidade_periodo', label: 'Capacidade do Período', icon: <BarChart2 className="w-4 h-4" /> },
        { id: 'execucao', label: 'Execução OP', icon: <Activity className="w-4 h-4" /> },
        { id: 'analise', label: 'Análise de Carga', icon: <BarChart2 className="w-4 h-4" /> }
    ];

    return (
        <div className="flex flex-col h-full border border-slate-300 shadow-sm bg-white rounded-md overflow-hidden">
            {/* Header Tabs */}
            <div className="flex bg-slate-100 border-b border-slate-300 overflow-x-auto shrink-0 scrollbar-hide">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-r border-slate-300 transition-colors whitespace-nowrap
                            ${activeTab === t.id 
                                ? 'bg-white text-[#1E3A5F] border-b-2 border-b-[#0D6EFD]' 
                                : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
                
                {/* FCS Simulation Config */}
                <div className="ml-auto flex items-center gap-3 px-4 bg-slate-50 border-l border-slate-300">
                    <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Data Início (FCS):</span>
                    <input 
                        type="date" 
                        value={data0}
                        onChange={e => setData0(e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-sm text-slate-700 bg-white"
                        title="Data base para simulação de prazos nas máquinas"
                    />
                    <button 
                        onClick={handleRunSimulation}
                        disabled={loading}
                        className="px-3 py-1.5 bg-[#1E3A5F] text-white text-sm font-medium rounded hover:bg-[#0D6EFD] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Simular Prazos
                    </button>

                    <div className="flex items-center gap-2 border-l border-slate-300 pl-3">
                        <button
                            onClick={handleExportExcel}
                            disabled={!data || loading}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                            title="Exportar todas as abas da Planilha Mestra para Excel (.xlsx)"
                        >
                            <Download className="w-4 h-4" />
                            Excel
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={!data || loading}
                            className="px-3 py-1.5 bg-rose-700 text-white text-sm font-medium rounded hover:bg-rose-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                            title="Exportar aba atual para PDF (.pdf)"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-slate-50 relative">
                {activeTab === 'capa' && <CapaTab data={data} />}
                {activeTab === 'docs' && <DocsTab />}
                {activeTab === 'resumo' && <ResumoTab data={data} />}
                {activeTab === 'pedidos' && <PedidosTab data={data} />}
                {activeTab === 'itens' && <ItensTab data={data} />}
                {activeTab === 'estruturas' && <EstruturasTab data={data} />}
                {activeTab === 'materiais_necessarios' && (
                    <MateriaisNecessariosTab 
                        data={data} 
                        baseCalculo={baseCalculo}
                        setBaseCalculo={setBaseCalculo}
                        exibirCustos={exibirCustos}
                        setExibirCustos={setExibirCustos}
                        canViewValues={canViewValues}
                        filtroTipo={filtroTipo}
                        setFiltroTipo={setFiltroTipo}
                    />
                )}
                {activeTab === 'carga' && <CargaTab data={data} />}
                {activeTab === 'capacidade_periodo' && <CapacidadePeriodoTab data={data} filterParams={filterParams} />}
                {activeTab === 'execucao' && <ExecucaoTab data={data} />}
                {activeTab === 'analise' && <AnaliseTab data={data} />}
            </div>
        </div>
    );
};

// ── SUB-COMPONENTES DAS ABAS ──────────────────────────────────────────────────

const formatNum = (val) => {
    if (val == null) return '';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    if (str.includes('T')) return str.split('T')[0].split('-').reverse().join('/');
    if (str.includes('-')) return str.split('-').reverse().join('/');
    return str.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
};

const CapaTab = ({ data }) => {
    const totalPedidos = data.pedidos.length;
    const totalItens = data.itens.length;
    const saldoTotal = data.itens.reduce((acc, it) => acc + (parseFloat(it.qtd_faturar) || 0), 0);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#1E3A5F] mb-6 border-b border-slate-300 pb-2">Planilha Mestra - Resumo</h2>
            <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-lg shadow border border-slate-200 text-center">
                    <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">Total Pedidos</div>
                    <div className="text-3xl font-black text-[#1E3A5F]">{totalPedidos}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-slate-200 text-center">
                    <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">Total Itens</div>
                    <div className="text-3xl font-black text-[#1E3A5F]">{totalItens}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-slate-200 text-center">
                    <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">Saldo a Faturar</div>
                    <div className="text-3xl font-black text-[#1E3A5F]">{formatNum(saldoTotal)}</div>
                </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-700 mb-4">Pedidos Incluídos</h3>
            <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#1E3A5F] text-white">
                        <tr>
                            <th className="px-4 py-2 border-b border-slate-300">Pedido</th>
                            <th className="px-4 py-2 border-b border-slate-300">Emissão</th>
                            <th className="px-4 py-2 border-b border-slate-300">Cliente</th>
                            <th className="px-4 py-2 border-b border-slate-300 text-right">Saldo a Faturar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.pedidos.map((p, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                <td className="px-4 py-2 border-b border-slate-200">{p.pedido}</td>
                                <td className="px-4 py-2 border-b border-slate-200">{formatDate(p.emissao)}</td>
                                <td className="px-4 py-2 border-b border-slate-200 font-medium">{p.cliente}</td>
                                <td className="px-4 py-2 border-b border-slate-200 text-right">{formatNum(p.soma_qtd)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DocsTab = () => (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="bg-[#1E3A5F] text-white p-4 rounded shadow">
            <h2 className="text-xl font-bold">GUIA DO RELATÓRIO: COMO LER A PLANILHA</h2>
        </div>
        
        <div>
            <h3 className="text-lg font-bold text-[#0D6EFD] mb-2 border-b pb-1">Resumo das Abas</h3>
            <ul className="space-y-3 text-sm text-slate-700">
                <li><strong className="text-[#1E3A5F]">Capa:</strong> Resumo executivo do relatório.</li>
                <li><strong className="text-[#1E3A5F]">Pedidos:</strong> Visão macro. Mostra uma linha por pedido. As colunas de recursos exibem a carga em HORAS.</li>
                <li><strong className="text-[#1E3A5F]">Itens Detalhados:</strong> Relação de itens pendentes sem os cálculos de carga.</li>
                <li><strong className="text-[#1E3A5F]">Carga por Recurso:</strong> Visão micro. Mostra a carga de cada item pendente individualmente em MINUTOS.</li>
                <li><strong className="text-[#1E3A5F]">Execução OP:</strong> Detalhamento da carga prevista x apontada para cada OP componente da estrutura do produto. Os tempos são exibidos em MINUTOS.</li>
                <li><strong className="text-[#1E3A5F]">Prog. Entregas:</strong> Matriz de entregas projetadas para os próximos 14 dias com base na Data PCP dos itens.</li>
            </ul>
        </div>

        <div>
            <h3 className="text-lg font-bold text-[#0D6EFD] mb-2 border-b pb-1">Unidades de Medida e Regras</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800 space-y-2">
                <p><strong>Atenção (Regra de 50 Minutos):</strong> Na aba Pedidos, os valores de tempo foram convertidos para HORAS PRODUTIVAS utilizando a métrica padrão MetalFisa.</p>
                <p><strong>1 HORA PRODUTIVA = 50 MINUTOS</strong> de trabalho líquido (excluindo pausas, setups extra, etc).</p>
            </div>
            <p className="text-sm mt-3 text-slate-700">
                <strong>Explosão da Estrutura (BOM):</strong> O cálculo percorre recursivamente a Engenharia somando tempos de TODOS os componentes filhos até o nível 0.
            </p>
        </div>
    </div>
);

const ResumoTab = ({ data }) => {
    // Agrupa a carga total de cada recurso por produto (em minutos na origem)
    const productLoads = useMemo(() => {
        const loads = {};
        if (data && data.carga) {
            data.carga.forEach(item => {
                const prod = item.produto;
                if (!loads[prod]) loads[prod] = {};
                
                (data.recursos || []).forEach(r => {
                    const valMinutos = item[`rec_${r}`] || 0;
                    loads[prod][r] = (loads[prod][r] || 0) + valMinutos;
                });
            });
        }
        return loads;
    }, [data.carga, data.recursos]);

    return (
        <div className="w-full h-full relative">
            <table className="w-full text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow">
                    <tr>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71]">Produto</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71]">Descrição</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] text-center">UM</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] text-right">Qtd Total</th>
                        {/* Dynamic Resource Columns (Azul Claro) */}
                        {(data.recursos || []).map(r => (
                            <th key={r} className="px-3 py-3 bg-[#0D6EFD] text-white border-r border-[#2C80FF] text-right whitespace-nowrap">
                                {data.recursoNomeMap?.[r] || r} (h)
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.resumo.map((row, idx) => {
                        const loads = productLoads[row.produto] || {};
                        return (
                            <tr key={idx} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                <td className="px-3 py-2 border-b border-slate-200 border-r font-semibold">
                                    <div className="flex items-center gap-2">
                                        <span>{row.produto}</span>
                                        <DrawingIcon produto={row.produto} />
                                    </div>
                                </td>
                                <td className="px-3 py-2 border-b border-slate-200 border-r max-w-[250px] truncate" title={row.descricao}>{row.descricao}</td>
                                <td className="px-3 py-2 border-b border-slate-200 border-r text-center">{row.um}</td>
                                <td className="px-3 py-2 border-b border-slate-200 border-r text-right font-medium">{formatNum(row.qtd_total)}</td>
                                {(data.recursos || []).map(r => {
                                    // Converter de minutos para horas (1h = 50 min)
                                    const valHoras = (loads[r] || 0) / 50;
                                    return (
                                        <td key={r} className={`px-3 py-2 border-b border-slate-200 border-r text-right ${valHoras > 0 ? 'text-[#0D6EFD] font-bold' : 'text-slate-400'}`}>
                                            {valHoras > 0 ? formatNum(valHoras) : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const PedidosTab = ({ data }) => {
    return (
        <div className="w-full h-full relative">
            <table className="w-full text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow">
                    <tr>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">Pedido</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">Emissão</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71]">Cliente</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">Qtd Itens</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">Soma QTD</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">Próx. Entrega</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">1ª Data PCP</th>
                        <th className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">Últ. Data PCP</th>
                        {/* Dynamic Resource Columns (Azul Claro) */}
                        {data.recursos.map(r => (
                            <th key={r} className="px-3 py-3 bg-[#0D6EFD] text-white border-r border-[#2C80FF] text-right whitespace-nowrap">
                                {data.recursoNomeMap[r] || r} (h)
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.pedidos.map((p, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                            <td className="px-3 py-2 border-b border-slate-200 border-r whitespace-nowrap font-semibold">{p.pedido}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r whitespace-nowrap">{formatDate(p.emissao)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[200px]">{p.cliente}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-center">{p.itens_count}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-right">{formatNum(p.soma_qtd)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r whitespace-nowrap">{formatDate(p.proxima_entrega)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r whitespace-nowrap">{formatDate(p.pcp_inicio)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r whitespace-nowrap">{formatDate(p.pcp_fim)}</td>
                            {data.recursos.map(r => {
                                const val = p[`rec_${r}`];
                                return (
                                    <td key={r} className={`px-3 py-2 border-b border-slate-200 border-r text-right ${val > 0 ? 'text-[#0D6EFD] font-bold' : 'text-slate-400'}`}>
                                        {val > 0 ? formatNum(val) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const EstruturasTab = ({ data }) => {
    const [groupBy, setGroupBy] = React.useState('produto'); // 'produto', 'pedido'

    if (!data.estruturas || data.estruturas.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500">
                Nenhuma estrutura de produto (BOM) encontrada para os itens filtrados.
            </div>
        );
    }

    const estruturasPorRaiz = (data.estruturas || []).reduce((acc, curr) => {
        if (!acc[curr.raiz]) acc[curr.raiz] = [];
        acc[curr.raiz].push(curr);
        return acc;
    }, {});

    const renderTable = (componentes, multiplier = null) => (
        <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                    <tr>
                        <th className="px-3 py-2 border-r border-slate-300 w-32 font-semibold">Componente</th>
                        <th className="px-3 py-2 border-r border-slate-300 font-semibold">Descri\u00e7\u00e3o</th>
                        <th className="px-3 py-2 border-r border-slate-300 w-16 text-center font-semibold">UM</th>
                        <th className="px-3 py-2 border-r border-slate-300 w-24 text-center font-semibold">Tipo</th>
                        <th className="px-3 py-2 text-right w-32 font-semibold">Qtd Unit\u00e1ria</th>
                        {multiplier !== null && <th className="px-3 py-2 text-right w-32 font-bold text-[#0D6EFD]">Total Necess\u00e1rio</th>}
                    </tr>
                </thead>
                <tbody>
                    {componentes.map((comp, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 last:border-b-0`}>
                            <td className="px-3 py-2 border-r border-slate-200 font-bold text-[#1E3A5F]">{comp.comp}</td>
                            <td className="px-3 py-2 border-r border-slate-200 text-slate-700">{comp.desc}</td>
                            <td className="px-3 py-2 border-r border-slate-200 text-slate-500 text-center font-semibold">{comp.um || '-'}</td>
                            <td className="px-3 py-2 border-r border-slate-200 text-slate-500 text-center">
                                <span className="px-2 py-0.5 bg-slate-200 rounded text-[11px] font-bold">{comp.tipo || 'N/A'}</span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatNum(comp.quant)}</td>
                            {multiplier !== null && <td className="px-3 py-2 font-bold text-right text-[#0D6EFD]">{formatNum(comp.quant * multiplier)}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    let content = null;

    if (groupBy === 'produto') {
        content = Object.entries(estruturasPorRaiz)
            .filter(([raiz]) => (data.itens || []).some(it => it.produto === raiz))
            .map(([raiz, componentes]) => {
            const qtdTotalDemandada = (data.itens || [])
                .filter(it => it.produto === raiz)
                .reduce((sum, it) => sum + (parseFloat(it.qtd_faturar) || 0), 0);

            return (
                <div key={raiz} className="mb-6 bg-white border border-slate-300 rounded shadow-sm overflow-hidden">
                    <div className="bg-[#1E3A5F] text-white px-4 py-2 font-bold flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Box className="w-4 h-4 text-blue-300" />
                            <span>Produto Pai: {raiz}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-normal text-blue-200">{componentes.length} componentes na engenharia</span>
                            <span className="text-sm font-bold bg-blue-500 bg-opacity-30 px-2 py-1 rounded text-white border border-blue-400">
                                Demanda do Filtro: {formatNum(qtdTotalDemandada)}
                            </span>
                        </div>
                    </div>
                    {renderTable(componentes, qtdTotalDemandada > 0 ? qtdTotalDemandada : null)}
                </div>
            );
        });
    } else if (groupBy === 'pedido') {
        const pedidosMap = (data.itens || []).reduce((acc, it) => {
            if (!acc[it.pedido]) acc[it.pedido] = { cliente: it.cliente, itens: [] };
            acc[it.pedido].itens.push(it);
            return acc;
        }, {});

        content = Object.entries(pedidosMap).map(([pedido, info]) => (
            <div key={pedido} className="mb-8 border border-[#0D6EFD] rounded-lg shadow-sm overflow-hidden bg-white">
                <div className="bg-[#0D6EFD] text-white px-4 py-3 font-bold flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Table className="w-5 h-5 text-blue-200" />
                        <span className="text-lg">Pedido: {pedido}</span>
                    </div>
                    <span className="text-sm font-medium text-blue-100 truncate max-w-sm">{info.cliente}</span>
                </div>
                <div className="p-4 space-y-6 bg-slate-50">
                    {info.itens.map((it, idx) => {
                        const componentes = estruturasPorRaiz[it.produto] || [];
                        const qtdFaturar = parseFloat(it.qtd_faturar) || 0;
                        return (
                            <div key={idx} className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white">
                                <div className="bg-slate-200 text-[#1E3A5F] px-3 py-2 font-semibold flex justify-between items-center border-b border-slate-300">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Item {it.item}</span>
                                        <span>Produto: {it.produto}</span>
                                    </div>
                                    <span className="text-sm">Qtd a Produzir: <strong className="text-[#0D6EFD] text-base">{formatNum(qtdFaturar)}</strong></span>
                                </div>
                                {componentes.length > 0 ? renderTable(componentes, qtdFaturar) : (
                                    <div className="p-4 text-center text-sm text-slate-400">Sem estrutura de engenharia.</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        ));
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-xl font-black text-[#1E3A5F]">Detalhamento da Estrutura (BOM)</h2>
                    <p className="text-sm text-slate-500 mt-1">Visualize a engenharia dos produtos e explos\u00e3o de materiais</p>
                </div>
                
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded border border-slate-200">
                    <button 
                        onClick={() => setGroupBy('produto')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded transition-all ${groupBy === 'produto' ? 'bg-white shadow text-[#0D6EFD] border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Agrupar por Produto Pai
                    </button>
                    <button 
                        onClick={() => setGroupBy('pedido')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded transition-all ${groupBy === 'pedido' ? 'bg-white shadow text-[#0D6EFD] border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Explodir por Pedido
                    </button>
                </div>
            </div>
            {content}
        </div>
    );
};

const MateriaisNecessariosTab = ({ 
    data, 
    baseCalculo, 
    setBaseCalculo, 
    exibirCustos, 
    setExibirCustos, 
    canViewValues,
    filtroTipo,
    setFiltroTipo
}) => {
    const itens = data.itens || [];
    const estruturas = data.estruturas || [];

    // State to toggle between Consolidated and Detailed views
    const [viewMode, setViewMode] = useState('consolidado'); // 'consolidado' | 'detalhado'
    const [filtroMaterial, setFiltroMaterial] = useState('');

    // Calculate detailed materials list
    const detailedDemands = useMemo(() => {
        const list = [];
        itens.forEach(item => {
            const parentProd = (item.produto || '').trim();
            // Calcula a quantidade final com base no seletor do usuário (Saldo a faturar vs Qtd do pedido)
            const parentQtd = baseCalculo === 'pedido'
                ? Number(item.qtd || 0)
                : Number(item.qtd_faturar || 0);

            // Find BOM components for this parent product
            const comps = estruturas.filter(e => e.raiz === parentProd);

            comps.forEach(c => {
                const totalQtd = parentQtd * c.quant;
                const custoUnit = c.custo_unitario || 0;
                const custoTotal = totalQtd * custoUnit;

                list.push({
                    pedido: item.pedido,
                    cliente: item.cliente,
                    produtoFinal: parentProd,
                    descFinal: item.descricao || '-',
                    qtdFaturar: parentQtd,
                    materialCod: c.comp,
                    materialDesc: c.desc || '-',
                    um: c.um || '-',
                    tipo: c.tipo || '-',
                    qtdUnit: c.quant,
                    qtdTotal: totalQtd,
                    custoUnit: custoUnit,
                    custoTotal: custoTotal
                });
            });
        });
        return list;
    }, [itens, estruturas, baseCalculo]);

    // Calculate consolidated list
    const consolidatedDemands = useMemo(() => {
        const map = {};
        detailedDemands.forEach(d => {
            const key = d.materialCod;
            if (!map[key]) {
                map[key] = {
                    materialCod: d.materialCod,
                    materialDesc: d.materialDesc,
                    um: d.um,
                    tipo: d.tipo,
                    qtdTotal: 0,
                    custoUnit: d.custoUnit,
                    custoTotal: 0
                };
            }
            map[key].qtdTotal += d.qtdTotal;
            map[key].custoTotal += d.custoTotal;
        });
        return Object.values(map).sort((a, b) => a.materialCod.localeCompare(b.materialCod));
    }, [detailedDemands]);

    // Filtered lists based on search input and type filter (defaults to 'MP')
    const filteredConsolidated = useMemo(() => {
        return consolidatedDemands.filter(d => {
            const matchesSearch = d.materialCod.toLowerCase().includes(filtroMaterial.toLowerCase()) ||
                                  d.materialDesc.toLowerCase().includes(filtroMaterial.toLowerCase());
            const matchesTipo = filtroTipo === 'Todos' || d.tipo.trim().toUpperCase() === filtroTipo.toUpperCase();
            return matchesSearch && matchesTipo;
        });
    }, [consolidatedDemands, filtroMaterial, filtroTipo]);

    const filteredDetailed = useMemo(() => {
        return detailedDemands.filter(d => {
            const matchesSearch = d.materialCod.toLowerCase().includes(filtroMaterial.toLowerCase()) ||
                                  d.materialDesc.toLowerCase().includes(filtroMaterial.toLowerCase()) ||
                                  d.pedido.toLowerCase().includes(filtroMaterial.toLowerCase()) ||
                                  d.produtoFinal.toLowerCase().includes(filtroMaterial.toLowerCase());
            const matchesTipo = filtroTipo === 'Todos' || d.tipo.trim().toUpperCase() === filtroTipo.toUpperCase();
            return matchesSearch && matchesTipo;
        });
    }, [detailedDemands, filtroMaterial, filtroTipo]);

    return (
        <div className="p-6 w-full">
            <div className="mb-6 border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-xl font-black text-[#1E3A5F]">Necessidade de Materiais / Componentes</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Detalhamento de insumos e matérias-primas calculados com base na estrutura de produto (BOM) e na base de cálculo escolhida.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Tipo Item selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                        <span className="text-xs font-bold text-slate-600">Tipo:</span>
                        <select
                            value={filtroTipo}
                            onChange={e => setFiltroTipo(e.target.value)}
                            className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="Todos">Todos</option>
                            <option value="MP">MP (Matéria-Prima)</option>
                            <option value="PI">PI (Prod. Intermediário)</option>
                            <option value="PA">PA (Prod. Acabado)</option>
                        </select>
                    </div>

                    {/* Calculation base toggle */}
                    <div className="flex bg-slate-100 p-1 rounded border border-slate-200" title="Defina se o cálculo de matéria-prima usará o saldo restante a faturar ou a quantidade original do pedido.">
                        <button
                            onClick={() => setBaseCalculo('saldo')}
                            className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${baseCalculo === 'saldo' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Saldo a Faturar
                        </button>
                        <button
                            onClick={() => setBaseCalculo('pedido')}
                            className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${baseCalculo === 'pedido' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Qtd do Pedido
                        </button>
                    </div>

                    {/* Cost values toggle */}
                    {canViewValues && (
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded border border-slate-200 cursor-pointer select-none text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors">
                            <input
                                type="checkbox"
                                checked={exibirCustos}
                                onChange={e => setExibirCustos(e.target.checked)}
                                className="rounded text-[#1E3A5F] focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                            Exibir Custos
                        </label>
                    )}

                    {/* View mode toggle */}
                    <div className="flex bg-slate-100 p-1 rounded border border-slate-200">
                        <button
                            onClick={() => setViewMode('consolidado')}
                            className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${viewMode === 'consolidado' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Visão Consolidada
                        </button>
                        <button
                            onClick={() => setViewMode('detalhado')}
                            className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${viewMode === 'detalhado' ? 'bg-[#1E3A5F] text-white' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Visão Detalhada (Por Pedido)
                        </button>
                    </div>

                    {/* Filter input */}
                    <input
                        type="text"
                        placeholder="Filtrar material/pedido..."
                        value={filtroMaterial}
                        onChange={e => setFiltroMaterial(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700 bg-white w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            {viewMode === 'consolidado' ? (
                <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#1E3A5F] text-white">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-300">Código do Material</th>
                                <th className="px-4 py-3 border-b border-slate-300">Descrição do Material</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-center w-24">UM</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-center w-24">Tipo</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-right w-48">Qtd Total Necessária</th>
                                {exibirCustos && (
                                    <>
                                        <th className="px-4 py-3 border-b border-slate-300 text-right w-36 bg-amber-50 text-amber-900 border-l border-slate-300">Custo Unitário</th>
                                        <th className="px-4 py-3 border-b border-slate-300 text-right w-44 bg-amber-600 text-white">Custo Total</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredConsolidated.length === 0 ? (
                                <tr>
                                    <td colSpan={exibirCustos ? 7 : 5} className="px-4 py-8 text-center text-slate-400">Nenhum material encontrado.</td>
                                </tr>
                            ) : filteredConsolidated.map((row, idx) => (
                                <tr key={row.materialCod} className={`hover:bg-blue-50 border-b border-slate-200 last:border-b-0 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <td className="px-4 py-3 font-mono font-bold text-[#1E3A5F]">{row.materialCod}</td>
                                    <td className="px-4 py-3 text-slate-800">{row.materialDesc}</td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-600">{row.um}</td>
                                    <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">{row.tipo}</span></td>
                                    <td className="px-4 py-3 text-right font-black text-blue-700 bg-blue-50 bg-opacity-30">{formatNum(row.qtdTotal)}</td>
                                    {exibirCustos && (
                                        <>
                                            <td className="px-4 py-3 text-right text-slate-800 bg-amber-50 bg-opacity-40 border-l border-slate-200">{row.custoUnit > 0 ? `R$ ${formatNum(row.custoUnit)}` : '-'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-amber-700 bg-amber-50">{row.custoTotal > 0 ? `R$ ${formatNum(row.custoTotal)}` : '-'}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-[#1E3A5F] text-white">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-300">Pedido</th>
                                <th className="px-4 py-3 border-b border-slate-300">Cliente</th>
                                <th className="px-4 py-3 border-b border-slate-300">Prod. Final</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-right w-24">Qtd Base</th>
                                <th className="px-4 py-3 border-b border-slate-300">Cód. Material</th>
                                <th className="px-4 py-3 border-b border-slate-300">Descrição do Material</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-center w-16">UM</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-right w-24">Qtd Unit. (BOM)</th>
                                <th className="px-4 py-3 border-b border-slate-300 text-right w-32 bg-[#0D6EFD] bg-opacity-10 text-blue-200">Qtd Necessária</th>
                                {exibirCustos && (
                                    <>
                                        <th className="px-4 py-3 border-b border-slate-300 text-right w-36 bg-amber-50 text-amber-900 border-l border-slate-300">Custo Unitário</th>
                                        <th className="px-4 py-3 border-b border-slate-300 text-right w-44 bg-amber-600 text-white">Custo Total</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDetailed.length === 0 ? (
                                <tr>
                                    <td colSpan={exibirCustos ? 11 : 9} className="px-4 py-8 text-center text-slate-400">Nenhum material detalhado encontrado.</td>
                                </tr>
                            ) : filteredDetailed.map((row, idx) => (
                                <tr key={`${row.pedido}_${row.materialCod}_${idx}`} className={`hover:bg-blue-50 border-b border-slate-200 last:border-b-0 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                    <td className="px-4 py-3 font-semibold text-slate-700">{row.pedido}</td>
                                    <td className="px-4 py-3 text-slate-600 truncate max-w-xs">{row.cliente}</td>
                                    <td className="px-4 py-3 font-mono text-slate-600" title={row.descFinal}>{row.produtoFinal}</td>
                                    <td className="px-4 py-3 text-right">{formatNum(row.qtdFaturar)}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-[#1E3A5F]">{row.materialCod}</td>
                                    <td className="px-4 py-3 text-slate-800 truncate max-w-xs">{row.materialDesc}</td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-600">{row.um}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatNum(row.qtdUnit)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-700 bg-[#0D6EFD] bg-opacity-5">{formatNum(row.qtdTotal)}</td>
                                    {exibirCustos && (
                                        <>
                                            <td className="px-4 py-3 text-right text-slate-800 bg-amber-50 bg-opacity-40 border-l border-slate-200">{row.custoUnit > 0 ? `R$ ${formatNum(row.custoUnit)}` : '-'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-amber-700 bg-amber-50">{row.custoTotal > 0 ? `R$ ${formatNum(row.custoTotal)}` : '-'}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const ItensTab = ({ data }) => (
    <div className="w-full h-full relative">
        <table className="w-full text-[13px] text-left border-collapse">
            <thead className="bg-[#1E3A5F] text-white sticky top-0 z-10 shadow">
                <tr>
                    {['Pedido', 'Cliente', 'Item', 'Produto', 'Descri\u00e7\u00e3o', 'UM', 'Prioridade', 'Qtd do Pedido', 'Qtd Faturada', 'Qtd Faturar (Produzir)', 'Entrega', 'Data PCP', 'Nova Data PCP', 'Status do Prazo'].map(h => (
                        <th key={h} className="px-3 py-3 border-r border-[#304C71] whitespace-nowrap">{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.itens.map((it, idx) => (
                    <tr key={idx} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                        <td className="px-3 py-2 border-b border-slate-200 border-r font-semibold">{it.pedido}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[150px]">{it.cliente}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r text-center">{it.item}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r">
                            <div className="flex items-center gap-2">
                                <span>{it.produto}</span>
                                <DrawingIcon produto={it.produto} />
                            </div>
                        </td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[200px]">{it.descricao}</td>
                          <td className="px-3 py-2 border-b border-slate-200 border-r text-center font-medium text-slate-500">{it.um || '-'}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r font-bold text-center">
                            {it.op_prioridade ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    it.op_prioridade === 1 ? 'bg-red-100 text-red-700' :
                                    it.op_prioridade === 2 ? 'bg-orange-100 text-orange-700' :
                                    it.op_prioridade === 3 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-blue-100 text-blue-700'
                                }`}>
                                    Grupo {it.op_prioridade}
                                </span>
                            ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r text-right font-medium text-slate-800">{formatNum(it.qtd)}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r text-right font-medium text-slate-600">{formatNum(it.qtd_entreg)}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r text-right font-bold text-[#0D6EFD]">{formatNum(it.qtd_faturar)}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r text-center">{formatDate(it.entrega)}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r text-center text-slate-500">{formatDate(it.data_pcp)}</td>
                        <td className="px-3 py-2 border-b border-slate-200 border-r font-bold text-slate-700 text-center">
                            {formatDate(it.nova_data_pcp) || '-'}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-200 text-center">
                            {(() => {
                                if (!it.nova_data_pcp) return <span className="text-slate-400">-</span>;
                                const original = it.data_pcp || it.entrega;
                                if (!original) return <span className="text-slate-400">-</span>;
                                
                                const nData = new Date(it.nova_data_pcp);
                                let origDateStr = String(original).trim();
                                if (origDateStr.length === 8 && !origDateStr.includes('-')) {
                                    origDateStr = `${origDateStr.slice(0,4)}-${origDateStr.slice(4,6)}-${origDateStr.slice(6,8)}`;
                                }
                                const oData = new Date(origDateStr);
                                
                                if (nData <= oData) {
                                    return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">OK</span>;
                                } else {
                                    return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">ATRASO</span>;
                                }
                            })()}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CargaTab = ({ data }) => {
    return (
        <div className="w-full h-full relative">
            <table className="w-full text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow">
                    <tr>
                        {['Pedido', 'Cliente', 'Item', 'Produto', 'Saldo a Faturar', 'Data PCP', 'Prioridade'].map(h => (
                            <th key={h} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-[#304C71] whitespace-nowrap">{h}</th>
                        ))}
                        {/* Dynamic Resource Columns (Azul Claro) */}
                        {data.recursos.map(r => (
                            <th key={r} className="px-3 py-3 bg-[#0D6EFD] text-white border-r border-[#2C80FF] text-right whitespace-nowrap">
                                {data.recursoNomeMap[r] || r} (min)
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.carga.map((c, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                            <td className="px-3 py-2 border-b border-slate-200 border-r font-semibold">{c.pedido}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[150px]">{c.cliente}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r">{c.item}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r">
                                <div className="flex items-center gap-2">
                                    <span>{c.produto}</span>
                                    <DrawingIcon produto={c.produto} />
                                </div>
                            </td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-right font-bold">{formatNum(c.qtd_faturar)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r">{formatDate(c.data_pcp)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r font-bold text-center">
                                {c.op_prioridade ? (
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                        c.op_prioridade === 1 ? 'bg-red-100 text-red-700' :
                                        c.op_prioridade === 2 ? 'bg-orange-100 text-orange-700' :
                                        c.op_prioridade === 3 ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        Grupo {c.op_prioridade}
                                    </span>
                                ) : <span className="text-slate-400">-</span>}
                            </td>
                            {data.recursos.map(r => {
                                const val = c[`rec_${r}`];
                                return (
                                    <td key={r} className={`px-3 py-2 border-b border-slate-200 border-r text-right ${val > 0 ? 'text-[#0D6EFD] font-bold' : 'text-slate-400'}`}>
                                        {val > 0 ? formatNum(val) : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const CapacidadePeriodoTab = ({ data, filterParams }) => {
    const recursos = data.recursos || [];
    const nomeMap = data.recursoNomeMap || {};
    const carga = data.carga || [];
    const capacidades = data.capacidades || {};

    // ── Calculate days in period ──
    const days = useMemo(() => {
        let dIni = filterParams?.dataInicial ? new Date(filterParams.dataInicial) : null;
        let dFim = filterParams?.dataFinal ? new Date(filterParams.dataFinal) : null;

        // If no explicit filter dates, try to find range from items data_pcp
        if (!dIni || !dFim) {
            const pcpDates = carga.map(c => {
                const dateVal = c.data_pcp || c.entrega;
                if (!dateVal) return null;
                const str = String(dateVal).trim();
                let d;
                if (str.length === 8 && !str.includes('-')) {
                    d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8));
                } else {
                    d = new Date(str);
                }
                return isNaN(d.getTime()) ? null : d;
            }).filter(Boolean);

            if (pcpDates.length > 0) {
                if (!dIni) dIni = new Date(Math.min(...pcpDates));
                if (!dFim) dFim = new Date(Math.max(...pcpDates));
            }
        }

        if (!dIni || !dFim) return 1;

        // Count working days (Mon-Fri)
        let count = 0;
        let cur = new Date(dIni.getTime());
        cur.setHours(0,0,0,0);
        const end = new Date(dFim.getTime());
        end.setHours(23,59,59,999);

        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
                count++;
            }
            cur.setDate(cur.getDate() + 1);
        }
        return count || 1;
    }, [filterParams, carga]);

    // ── Calculate load and totals per resource ──
    const reportData = useMemo(() => {
        const MIN_POR_HORA = 55;
        return recursos.map(r => {
            const cod = r.trim().toUpperCase();
            const capDiaria = capacidades[cod] || 0;
            const capTotal = capDiaria * days;

            // Sum load for this resource across all items in data.carga
            const cargaPrevista = carga.reduce((sum, item) => {
                // If filter date range is specified, strictly filter items to that range
                if (filterParams?.dataInicial && filterParams?.dataFinal) {
                    const itemDateVal = item.data_pcp || item.entrega;
                    if (itemDateVal) {
                        const str = String(itemDateVal).trim();
                        let d;
                        if (str.length === 8 && !str.includes('-')) {
                            d = new Date(str.substring(0, 4) + '-' + str.substring(4, 6) + '-' + str.substring(6, 8) + 'T00:00:00');
                        } else {
                            d = new Date(str);
                        }
                        if (!isNaN(d.getTime())) {
                            const dIniLimit = new Date(filterParams.dataInicial);
                            const dFimLimit = new Date(filterParams.dataFinal);
                            if (d < dIniLimit || d > dFimLimit) {
                                return sum; // Ignore residual/backlog load
                            }
                        }
                    }
                }
                return sum + (Number(item['rec_' + r]) || 0);
            }, 0);

            const saldo = capTotal - cargaPrevista;
            const ocupacao = capTotal > 0 ? (cargaPrevista / capTotal) * 100 : 0;

            return {
                recurso: r,
                nome: nomeMap[r] || r,
                capDiariaHrs: capDiaria / MIN_POR_HORA,
                capTotalHrs: capTotal / MIN_POR_HORA,
                cargaPrevistaHrs: cargaPrevista / MIN_POR_HORA,
                saldoHrs: saldo / MIN_POR_HORA,
                ocupacao
            };
        });
    }, [recursos, capacidades, days, carga, nomeMap, filterParams]);

    return (
        <div className="p-6 w-full">
            <div className="mb-6 border-b border-slate-200 pb-4 flex justify-between items-end">
                <div>
                    <h2 className="text-xl font-black text-[#1E3A5F]">Capacidade do Período Filtrado</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Carga prevista (soma total de horas) comparada à capacidade total das máquinas no período selecionado. (1 hora = 55 minutos)
                    </p>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded border border-slate-200 text-right">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Dias Úteis no Período (Seg-Sex)</span>
                    <span className="text-lg font-black text-[#1E3A5F]">{days} {days === 1 ? 'Dia Útil' : 'Dias Úteis'}</span>
                </div>
            </div>

            <div className="border border-slate-300 rounded overflow-hidden shadow-sm bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[#1E3A5F] text-white">
                        <tr>
                            <th className="px-4 py-3 border-b border-slate-300">Recurso / Máquina</th>
                            <th className="px-4 py-3 border-b border-slate-300 text-right">Capacidade Diária (h)</th>
                            <th className="px-4 py-3 border-b border-slate-300 text-right">Capacidade Total (h)</th>
                            <th className="px-4 py-3 border-b border-slate-300 text-right bg-[#0D6EFD] bg-opacity-10 text-blue-200">Carga Prevista (h)</th>
                            <th className="px-4 py-3 border-b border-slate-300 text-right">Saldo Capacidade (h)</th>
                            <th className="px-4 py-3 border-b border-slate-300 text-center w-32">% Ocupação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map((row, idx) => (
                            <tr key={row.recurso} className={`hover:bg-blue-50 border-b border-slate-200 last:border-b-0 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                <td className="px-4 py-3 font-semibold text-[#1E3A5F]">{row.nome}</td>
                                <td className="px-4 py-3 text-right">{formatNum(row.capDiariaHrs)}</td>
                                <td className="px-4 py-3 text-right">{formatNum(row.capTotalHrs)}</td>
                                <td className="px-4 py-3 text-right font-bold text-[#0D6EFD] bg-[#0D6EFD] bg-opacity-5">{formatNum(row.cargaPrevistaHrs)}</td>
                                <td className={`px-4 py-3 text-right font-semibold ${row.saldoHrs < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                    {formatNum(row.saldoHrs)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-16 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className={`h-2.5 rounded-full ${row.ocupacao > 100 ? 'bg-red-500' : row.ocupacao > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                                style={{ width: `${Math.min(row.ocupacao, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className={`text-xs font-bold ${row.ocupacao > 100 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {formatNum(row.ocupacao)}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ExecucaoTab = ({ data }) => {
    // Retorna vazio caso execucao_op não exista no payload ainda (retrocompatibilidade)
    if (!data.execucao_op) return (
        <div className="p-8 text-center text-slate-500">
            Nenhum dado de execução encontrado.
        </div>
    );

    return (
        <div className="w-full h-full relative">
            <table className="w-full text-[13px] text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow">
                    <tr>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap">Pedido</th>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap">Cliente</th>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap">OP</th>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap">Produto</th>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap text-right">Qtd Plan</th>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap text-center">Data PCP</th>
                        <th rowSpan={2} className="px-3 py-3 bg-[#1E3A5F] text-white border-r border-b border-[#304C71] whitespace-nowrap text-right">Qtde PCP</th>
                        {/* Dynamic Resource Columns */}
                        {data.recursos.map(r => (
                            <th colSpan={2} key={r} className="px-3 py-1 bg-[#0D6EFD] text-white border-r border-b border-[#2C80FF] text-center whitespace-nowrap">
                                {data.recursoNomeMap[r] || r} (min)
                            </th>
                        ))}
                    </tr>
                    <tr>
                        {data.recursos.map(r => (
                            <React.Fragment key={r + '_subs'}>
                                <th className="px-2 py-1 bg-[#0958CC] text-white border-r border-[#2C80FF] text-right font-medium text-xs">Prev</th>
                                <th className="px-2 py-1 bg-[#0958CC] text-white border-r border-[#2C80FF] text-right font-medium text-xs">Apon</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.execucao_op.map((c, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                            <td className="px-3 py-2 border-b border-slate-200 border-r font-semibold">{c.pedido}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r truncate max-w-[150px]">{c.cliente}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r font-mono text-xs">{c.op}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r">
                                <div className="flex items-center gap-2">
                                    <span>{c.produto}</span>
                                    <DrawingIcon produto={c.produto} />
                                </div>
                            </td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-right">{formatNum(c.qtd_planejada)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-center whitespace-nowrap">{formatDate(c.data_pcp)}</td>
                            <td className="px-3 py-2 border-b border-slate-200 border-r text-right">{c.qtde_pcp != null ? formatNum(c.qtde_pcp) : '-'}</td>
                            {data.recursos.map(r => {
                                const previsto = c[`previsto_${r}`] || 0;
                                const apontado = c[`apontado_${r}`] || 0;
                                return (
                                    <React.Fragment key={r + '_vals'}>
                                        <td className={`px-2 py-2 border-b border-slate-200 border-r text-right ${previsto > 0 ? 'text-[#0D6EFD] font-bold' : 'text-slate-400'}`}>
                                            {previsto > 0 ? formatNum(previsto) : '-'}
                                        </td>
                                        <td className={`px-2 py-2 border-b border-slate-200 border-r text-right ${apontado > 0 ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                                            {apontado > 0 ? formatNum(apontado) : '-'}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── HELPERS DE AGRUPAMENTO ──────────────────────────────────────────────────

const getWeekStart = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay(); // 0 = dom
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
};

const getMonthStart = (dateStr) => dateStr.substring(0, 7) + '-01';

const getQuinzenaStart = (dateStr) => {
    const d = parseInt(dateStr.substring(8, 10), 10);
    return dateStr.substring(0, 8) + (d <= 15 ? '01' : '16');
};

const normalizeToISO = (dateStr) => {
    if (!dateStr) return null;
    // Se for objeto Date
    if (dateStr instanceof Date) return dateStr.toISOString().split('T')[0];
    const s = String(dateStr).trim();
    // Formato YYYYMMDD (sem traços) → YYYY-MM-DD
    if (/^\d{8}$/.test(s)) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
    // Já no formato YYYY-MM-DD ou com T (ISO)
    if (s.includes('T')) return s.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return null;
};

const getBucketKey = (dateStr, agrupamento) => {
    const ds = normalizeToISO(dateStr);
    if (!ds) return null;
    if (agrupamento === 'dia')      return ds;
    if (agrupamento === 'semana')   return getWeekStart(ds);
    if (agrupamento === 'quinzena') return getQuinzenaStart(ds);
    if (agrupamento === 'mes')      return getMonthStart(ds);
    return ds;
};

const formatBucketLabel = (key, agrupamento) => {
    if (!key) return '—';
    const [y, m, d] = key.split('-');
    if (agrupamento === 'dia')      return `${d}/${m}/${y}`;
    if (agrupamento === 'semana')   return `Sem ${d}/${m}`;
    if (agrupamento === 'quinzena') return parseInt(d) <= 15 ? `1ª Qnz ${m}/${y}` : `2ª Qnz ${m}/${y}`;
    if (agrupamento === 'mes') {
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        return `${meses[parseInt(m)-1]}/${y}`;
    }
    return key;
};

// ── COMPONENTE TOTAL/MÊS ──────────────────────────────────────────────────────
const TotalMesChart = ({ recursosVisiveis, buckets, matrix, capacidades, agrupamento, workingDaysInBucket }) => {
    // Agrega todos os recursos por bucket
    const seriesData = buckets.map(b => {
        let totalCap  = 0;
        let totalPrev = 0;
        let totalApon = 0;
        recursosVisiveis.forEach(r => {
            const capDia = capacidades[(r || '').trim().toUpperCase()] || 0;
            totalCap  += capDia * workingDaysInBucket(b, agrupamento);
            totalPrev += matrix[r]?.[b]?.previsto || 0;
            totalApon += matrix[r]?.[b]?.apontado || 0;
        });
        return {
            label:    formatBucketLabel(b, agrupamento),
            capH:     totalCap  / 60,
            prevH:    totalPrev / 60,
            aponH:    totalApon / 60,
            pctOcup:  totalCap  > 0 ? Math.min(200, (totalPrev / totalCap) * 100) : 0,
            pctExec:  totalPrev > 0 ? Math.min(100, (totalApon / totalPrev) * 100) : 0,
        };
    }).filter(d => d.prevH > 0 || d.aponH > 0);

    if (seriesData.length === 0) return <div className="p-8 text-center text-slate-400">Sem dados para exibir.</div>;

    // KPI totais
    const totCapH  = seriesData.reduce((s, d) => s + d.capH,  0);
    const totPrevH = seriesData.reduce((s, d) => s + d.prevH, 0);
    const totAponH = seriesData.reduce((s, d) => s + d.aponH, 0);
    const pctOcupTotal = totCapH > 0 ? (totPrevH / totCapH * 100) : 0;
    const pctExecTotal = totPrevH > 0 ? (totAponH / totPrevH * 100) : 0;

    // Dimensões SVG — escala inclui capacidade pois é o referencial
    const CHART_H  = 200;
    const BAR_W    = 28;
    const GAP      = 6;
    const PAD_L    = 52;
    const PAD_TOP  = 14; // espaço para label no topo das barras
    const GROUP_W  = BAR_W * 3 + GAP * 2 + 20;
    const CHART_W  = Math.max(seriesData.length * GROUP_W + PAD_L + 20, 480);

    const maxVal = Math.max(...seriesData.flatMap(d => [d.capH, d.prevH, d.aponH]), 1);
    const toH = v => Math.max(0, (v / maxVal) * CHART_H);
    const base = PAD_TOP + CHART_H;

    const ocupColor = (pct) => pct >= 100 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#6366f1';
    const execColor = (pct) => pct >= 80  ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className="p-5 flex flex-col gap-5 h-full">

            {/* ── KPI Bar ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Capacidade Total', value: `${totCapH.toFixed(0)}h`, sub: 'todos os recursos / período', color: '#6b7280' },
                    { label: 'Previsto Total',   value: `${totPrevH.toFixed(0)}h`, sub: `Ocupação: ${pctOcupTotal.toFixed(1)}%`, color: ocupColor(pctOcupTotal) },
                    { label: 'Apontado Total',   value: `${totAponH.toFixed(0)}h`, sub: `Executado: ${pctExecTotal.toFixed(1)}%`, color: execColor(pctExecTotal) },
                ].map(k => (
                    <div key={k.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col gap-0.5">
                        <span className="text-[11px] text-slate-500 font-medium">{k.label}</span>
                        <span className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</span>
                        <span className="text-[10px] text-slate-400">{k.sub}</span>
                    </div>
                ))}
            </div>

            {/* ── Gráfico SVG ──────────────────────────────────────────── */}
            <div className="flex-1 overflow-x-auto">
                <svg viewBox={`0 0 ${CHART_W} ${PAD_TOP + CHART_H + 52}`} width={Math.max(CHART_W, 480)} style={{ display: 'block', minWidth: '100%' }}>

                    {/* Grid lines Y */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const y = PAD_TOP + CHART_H * (1 - pct);
                        return (
                            <g key={pct}>
                                <line x1={PAD_L} y1={y} x2={CHART_W} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                                <text x={PAD_L - 4} y={y + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                                    {(maxVal * pct).toFixed(0)}h
                                </text>
                            </g>
                        );
                    })}

                    {/* Barras por período */}
                    {seriesData.map((d, i) => {
                        const gx = PAD_L + 4 + i * GROUP_W;

                        const hCap  = toH(d.capH);
                        const hPrev = toH(d.prevH);
                        const hApon = toH(d.aponH);

                        // Previsto bicolor se sobrecarga
                        const isOverloaded = d.capH > 0 && d.prevH > d.capH;
                        const hPrevBlue = isOverloaded ? toH(d.capH) : hPrev;
                        const hPrevRed  = isOverloaded ? Math.max(0, hPrev - toH(d.capH)) : 0;

                        const aponCol = execColor(d.pctExec);
                        const prevCol = isOverloaded ? '#ef4444' : '#6366f1';

                        return (
                            <g key={i}>
                                {/* Barra Capacidade */}
                                {hCap > 0 && <rect x={gx}                   y={base - hCap}       width={BAR_W} height={hCap}       fill="#e2e8f0" rx={3} />}
                                <text x={gx + BAR_W/2} y={base - hCap - 4}  textAnchor="middle" fontSize={8} fill="#9ca3af" fontWeight="600">
                                    {d.capH.toFixed(0)}h
                                </text>

                                {/* Barra Previsto — azul + vermelho */}
                                {hPrevBlue > 0 && <rect x={gx + BAR_W + GAP}   y={base - hPrevBlue}  width={BAR_W} height={hPrevBlue}  fill="#818cf8" rx={3} />}
                                {hPrevRed  > 0 && <rect x={gx + BAR_W + GAP}   y={base - hPrev}      width={BAR_W} height={hPrevRed}   fill="#ef4444" rx={3} />}
                                <text x={gx + BAR_W + GAP + BAR_W/2} y={base - hPrev - 4} textAnchor="middle" fontSize={8} fill={prevCol} fontWeight="700">
                                    {d.prevH.toFixed(0)}h
                                </text>

                                {/* Barra Apontado */}
                                {hApon > 0 && <rect x={gx + (BAR_W + GAP)*2}  y={base - hApon}      width={BAR_W} height={hApon}      fill={aponCol} rx={3} />}
                                {hApon > 0 && <text x={gx + (BAR_W + GAP)*2 + BAR_W/2} y={base - hApon - 4} textAnchor="middle" fontSize={8} fill={aponCol} fontWeight="700">
                                    {d.aponH.toFixed(0)}h
                                </text>}

                                {/* % Ocupação acima das barras */}
                                <text x={gx + BAR_W + GAP + BAR_W/2} y={base + 16} textAnchor="middle" fontSize={9} fill={ocupColor(d.pctOcup)} fontWeight="700">
                                    {d.pctOcup.toFixed(0)}%
                                </text>

                                {/* Label do período */}
                                <text x={gx + BAR_W + GAP + BAR_W/2} y={base + 30} textAnchor="middle" fontSize={10} fill="#1E3A5F" fontWeight="600">
                                    {d.label}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Legenda */}
            <div className="flex gap-6 justify-center text-xs text-slate-500 flex-wrap pb-1">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-200"/><span>Capacidade Total</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{background:'#818cf8'}}/><span>Previsto (dentro da cap.)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500"/><span>Previsto acima da cap.</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500"/><span>Apontado (🟢≥80% 🟡40-80% 🔴&lt;40%)</span></div>
            </div>
        </div>
    );
};

// ── COMPONENTE CONSOLIDADO ────────────────────────────────────────────────────
const ConsolidadoChart = ({ recursosVisiveis, buckets, matrix, nomeMap, capacidades, agrupamento, workingDaysInBucket }) => {
    // Para cada recurso: soma total de previsto e apontado por bucket (em horas)
    const recData = recursosVisiveis.map(r => {
        const capDia = capacidades[(r || '').trim().toUpperCase()] || 0;
        const totalCap  = buckets.reduce((s, b) => s + capDia * workingDaysInBucket(b, agrupamento), 0);
        const totalPrev = buckets.reduce((s, b) => s + (matrix[r]?.[b]?.previsto || 0), 0);
        const totalApon = buckets.reduce((s, b) => s + (matrix[r]?.[b]?.apontado || 0), 0);
        return { r, nome: nomeMap[r] || '', capH: totalCap / 60, prevH: totalPrev / 60, aponH: totalApon / 60 };
    }).filter(d => d.prevH > 0 || d.aponH > 0);

    // Dados por bucket (mês/semana) × recurso: para o gráfico de barras agrupadas por período
    const bucketData = buckets.map(b => {
        const label = formatBucketLabel(b, agrupamento);
        const recursos = recursosVisiveis
            .map(r => {
                const capDia = capacidades[(r || '').trim().toUpperCase()] || 0;
                return {
                    r,
                    nome: nomeMap[r] || r,
                    capH:  (capDia * workingDaysInBucket(b, agrupamento)) / 60,
                    prevH: (matrix[r]?.[b]?.previsto || 0) / 60,
                    aponH: (matrix[r]?.[b]?.apontado || 0) / 60,
                };
            })
            .filter(d => d.prevH > 0 || d.aponH > 0);
        return { label, recursos };
    }).filter(b => b.recursos.length > 0);

    if (bucketData.length === 0 || recData.length === 0) {
        return <div className="p-8 text-center text-slate-400">Sem dados para exibir.</div>;
    }

    // Dimensões SVG
    const CHART_H  = 220;
    const BAR_W    = 16;
    const BAR_GAP  = 3;
    const PERIOD_GAP = 24;
    const LABEL_H  = 48;
    const LEFT_PAD = 48;

    // Calcula largura total: para cada bucket, uma barra por recurso (Prev + Apon = 2 barras)
    const maxRec   = Math.max(...bucketData.map(b => b.recursos.length));
    const groupW   = maxRec * (BAR_W * 2 + BAR_GAP + 4) + PERIOD_GAP;
    const CHART_W  = LEFT_PAD + bucketData.length * groupW + 16;

    const maxVal = Math.max(
        ...bucketData.flatMap(b => b.recursos.flatMap(r => [r.capH, r.prevH, r.aponH])),
        1
    );

    const toH = (v) => Math.max(0, (v / maxVal) * CHART_H);

    // Paleta de cores por recurso (ciclo de 8)
    const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];

    return (
        <div className="p-4 flex flex-col gap-4 h-full">
            {/* Legenda de recursos */}
            <div className="flex flex-wrap gap-3 px-2">
                {recData.map((d, i) => (
                    <div key={d.r} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <div className="w-3 h-3 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                        <span className="font-semibold text-slate-700">{d.r}</span>
                        <span className="text-slate-400">{d.nome}</span>
                    </div>
                ))}
            </div>

            {/* Gráfico principal */}
            <div className="flex-1 overflow-x-auto">
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H + LABEL_H + 20}`} width={Math.max(CHART_W, 600)} height={CHART_H + LABEL_H + 20} style={{ display: 'block', minWidth: '100%' }}>
                    {/* Grid lines Y */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const y = 8 + CHART_H * (1 - pct);
                        return (
                            <g key={pct}>
                                <line x1={LEFT_PAD} y1={y} x2={CHART_W} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                                <text x={LEFT_PAD - 4} y={y + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
                                    {(maxVal * pct).toFixed(0)}h
                                </text>
                            </g>
                        );
                    })}

                    {/* Barras por período */}
                    {bucketData.map((bucket, bi) => {
                        const bx = LEFT_PAD + bi * groupW;
                        const recMap = {};
                        recData.forEach((d, i) => { recMap[d.r] = i; });

                        return (
                            <g key={bi}>
                                {/* Label do período */}
                                <text
                                    x={bx + groupW / 2 - PERIOD_GAP / 2}
                                    y={8 + CHART_H + 16}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fontWeight="600"
                                    fill="#1E3A5F"
                                >
                                    {bucket.label}
                                </text>

                                {/* Separador de período */}
                                {bi > 0 && <line x1={bx - 4} y1={8} x2={bx - 4} y2={8 + CHART_H} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3,3" />}

                                {/* Barras por recurso dentro do período */}
                                {bucket.recursos.map((rec, ri) => {
                                    const colorIdx = recMap[rec.r] ?? ri;
                                    const color = PALETTE[colorIdx % PALETTE.length];
                                    const rx = bx + ri * (BAR_W * 2 + BAR_GAP + 4);

                                    const hPrev = toH(rec.prevH);
                                    const hApon = toH(rec.aponH);
                                    const hCap  = toH(rec.capH);
                                    const base  = 8 + CHART_H;

                                    // Barra Previsto: bicolor se sobrecarga
                                    const isOverloaded = rec.capH > 0 && rec.prevH > rec.capH;
                                    const hPrevBlue = isOverloaded ? toH(rec.capH) : hPrev;
                                    const hPrevRed  = isOverloaded ? hPrev - toH(rec.capH) : 0;

                                    // Executado: cor por %
                                    const execPct = rec.prevH > 0 ? rec.aponH / rec.prevH : 0;
                                    const aponColor = execPct >= 0.8 ? '#10b981' : execPct >= 0.4 ? '#f59e0b' : '#ef4444';

                                    return (
                                        <g key={ri}>
                                            {/* Linha de capacidade (tracejada) */}
                                            {hCap > 0 && (
                                                <line
                                                    x1={rx} x2={rx + BAR_W * 2 + BAR_GAP + 2}
                                                    y1={base - hCap} y2={base - hCap}
                                                    stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,2"
                                                />
                                            )}
                                            {/* Barra Previsto — parte azul */}
                                            {hPrevBlue > 0 && <rect x={rx} y={base - hPrevBlue} width={BAR_W} height={hPrevBlue} fill={color} rx={2} opacity={0.85} />}
                                            {/* Barra Previsto — parte vermelha (excedente) */}
                                            {hPrevRed > 0  && <rect x={rx} y={base - hPrev}      width={BAR_W} height={hPrevRed}  fill="#ef4444" rx={2} />}
                                            {/* Barra Apontado */}
                                            {hApon > 0 && <rect x={rx + BAR_W + BAR_GAP} y={base - hApon} width={BAR_W} height={hApon} fill={aponColor} rx={2} opacity={0.9} />}
                                            {/* Código do recurso no eixo X */}
                                            <text
                                                x={rx + BAR_W}
                                                y={base + 28}
                                                textAnchor="middle"
                                                fontSize={8}
                                                fill="#475569"
                                            >
                                                {rec.r}
                                            </text>
                                            {/* Valor Apontado no topo da barra */}
                                            {hApon > 8 && (
                                                <text x={rx + BAR_W + BAR_GAP + BAR_W/2} y={base - hApon - 3} textAnchor="middle" fontSize={7} fill={aponColor} fontWeight="600">
                                                    {rec.aponH.toFixed(0)}h
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Legenda de barras */}
            <div className="flex gap-6 justify-center pb-2 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-1.5 rounded" style={{ background: '#94a3b8', borderTop: '2px dashed #94a3b8' }} />
                    <span>Linha de Capacidade</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-500 opacity-85" />
                    <span>Previsto (cor = recurso)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: '#ef4444' }} />
                    <span>Previsto acima da cap.</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <span>Apontado (🟢≥80% 🟡40-80% 🔴{'<'}40%)</span>
                </div>
            </div>
        </div>
    );
};

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const AnaliseTab = ({ data }) => {
    const execucao = data.execucao_op || [];
    const recursos  = data.recursos    || [];
    const nomeMap   = data.recursoNomeMap || {};

    // ── Listas únicas para os selects ──────────────────────────────────────
    const allClientes = useMemo(() => [...new Set(execucao.map(r => r.cliente).filter(Boolean))].sort(), [execucao]);

    // ── Busca capacidades da API ─────────────────────────────────────────
    const [capacidades, setCapacidades] = useState({}); // { cod_recurso: minutos/dia }
    useEffect(() => {
        api.get('/pcp-refinado/recursos')
            .then(res => {
                const map = {};
                (res.data || []).forEach(r => {
                    const cod = (r.cod_recurso || '').trim().toUpperCase();
                    map[cod] = Number(r.capacidade_diaria_minutos) || 0;
                });
                setCapacidades(map);
            })
            .catch(() => {}); // silencioso
    }, []);



    // ── Estado dos filtros ───────────────────────────────────────────────
    const [agrupamento,  setAgrupamento]  = useState('semana');
    const [selectedRecs, setSelectedRecs] = useState([]);
    const [selectedClis, setSelectedClis] = useState([]);
    const [filtroPedido, setFiltroPedido] = useState('');
    const [filtroProd,   setFiltroProd]   = useState('');
    const [periodoIni,   setPeriodoIni]   = useState('');
    const [periodoFim,   setPeriodoFim]   = useState('');
    const [inclSabado,   setInclSabado]   = useState(false);
    const [inclDomingo,  setInclDomingo]  = useState(false);


    // ── Recursos visíveis (após filtro de recurso) ────────────────────────
    const recursosVisiveis = useMemo(
        () => selectedRecs.length > 0 ? selectedRecs : recursos,
        [selectedRecs, recursos]
    );

    // ── Aplica filtros de linha ───────────────────────────────────────────
    const rowsFiltradas = useMemo(() => {
        return execucao.filter(r => {
            if (selectedClis.length > 0 && !selectedClis.includes(r.cliente)) return false;
            if (filtroPedido && !String(r.pedido || '').toLowerCase().includes(filtroPedido.toLowerCase())) return false;
            if (filtroProd   && !String(r.produto || '').toLowerCase().includes(filtroProd.toLowerCase()))  return false;
            // Normaliza para YYYY-MM-DD antes de comparar (data_pcp pode vir como YYYYMMDD)
            const dataPcp = normalizeToISO(r.data_pcp);
            if (periodoIni && dataPcp && dataPcp < periodoIni) return false;
            if (periodoFim && dataPcp && dataPcp > periodoFim) return false;
            return true;
        });
    }, [execucao, selectedClis, filtroPedido, filtroProd, periodoIni, periodoFim]);

    // ── Monta a matriz: rec → bucket → { previsto, apontado } ─────────────
    const { matrix, buckets } = useMemo(() => {
        const mat = {};
        const buckSet = new Set();

        recursosVisiveis.forEach(r => { mat[r] = {}; });

        rowsFiltradas.forEach(row => {
            const bucket = getBucketKey(row.data_pcp, agrupamento);
            if (!bucket) return;
            buckSet.add(bucket);
            recursosVisiveis.forEach(r => {
                if (!mat[r][bucket]) mat[r][bucket] = { previsto: 0, apontado: 0 };
                mat[r][bucket].previsto += row[`previsto_${r}`] || 0;
                mat[r][bucket].apontado += row[`apontado_${r}`] || 0;
            });
        });

        const sortedBuckets = [...buckSet].sort();
        return { matrix: mat, buckets: sortedBuckets };
    }, [rowsFiltradas, recursosVisiveis, agrupamento]);

    // ── Helpers de toggle ────────────────────────────────────────────────
    const toggleRec = (r) => setSelectedRecs(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    const toggleCli = (c) => setSelectedClis(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

    // ── Modo de visualização ─────────────────────────────────────────────
    const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'

    // ── Cor da célula ────────────────────────────────────────────────────
    const getCellColor = (previsto, apontado) => {
        if (!previsto || previsto === 0) return null;
        const pct = (apontado / previsto) * 100;
        if (pct >= 80) return { bg: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-700' };
        if (pct >= 40) return { bg: 'bg-amber-50',   bar: 'bg-amber-400',   text: 'text-amber-700' };
        return           { bg: 'bg-red-50',     bar: 'bg-red-400',     text: 'text-red-700' };
    };

    // ── Dias úteis por intervalo de bucket (respeita incl. Sáb/Dom) ────────────
    const workingDaysInBucket = (bucketKey, agrup) => {
        const d = new Date(bucketKey + 'T12:00:00');
        if (isNaN(d)) return 1;
        let end;
        if (agrup === 'dia')       { end = new Date(d); end.setDate(d.getDate() + 1); }
        else if (agrup === 'semana')   { end = new Date(d); end.setDate(d.getDate() + 7); }
        else if (agrup === 'quinzena') { end = new Date(d); end.setDate(d.getDate() + 15); }
        else if (agrup === 'mes')  { end = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
        else                       { end = new Date(d); end.setDate(d.getDate() + 7); }
        let count = 0;
        const cur = new Date(d);
        while (cur < end) {
            const dow = cur.getDay(); // 0=Dom, 6=Sáb
            const isSat = dow === 6;
            const isSun = dow === 0;
            if (!isSat && !isSun)             count++;  // Seg–Sex: sempre conta
            else if (isSat && inclSabado)     count++;  // Sáb: só se habilitado
            else if (isSun && inclDomingo)    count++;  // Dom: só se habilitado
            cur.setDate(cur.getDate() + 1);
        }
        return Math.max(count, 1);
    };

    const totaisPorBucket = useMemo(() => {
        const t = {};
        buckets.forEach(b => {
            t[b] = { previsto: 0, apontado: 0 };
            recursosVisiveis.forEach(r => {
                t[b].previsto += matrix[r]?.[b]?.previsto || 0;
                t[b].apontado += matrix[r]?.[b]?.apontado || 0;
            });
        });
        return t;
    }, [buckets, recursosVisiveis, matrix]);

    if (execucao.length === 0) return (
        <div className="p-8 text-center text-slate-500">Nenhum dado de execução disponível.</div>
    );

    return (
        <div className="flex flex-col h-full">

            {/* ── PAINEL DE FILTROS ─────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
                <div className="flex flex-wrap gap-3 items-end">

                    {/* Agrupamento */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Agrupamento</label>
                        <select
                            value={agrupamento}
                            onChange={e => setAgrupamento(e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                            <option value="dia">Dia</option>
                            <option value="semana">Semana</option>
                            <option value="quinzena">Quinzena</option>
                            <option value="mes">Mês</option>
                        </select>
                    </div>

                    {/* Período */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Período (Data PCP)</label>
                        <div className="flex gap-1 items-center">
                            <input type="date" value={periodoIni} onChange={e => setPeriodoIni(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            <span className="text-slate-400 text-xs">até</span>
                            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            {(periodoIni || periodoFim) && (
                                <button onClick={() => { setPeriodoIni(''); setPeriodoFim(''); }}
                                    className="text-slate-400 hover:text-red-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Pedido */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pedido</label>
                        <input value={filtroPedido} onChange={e => setFiltroPedido(e.target.value)} placeholder="Filtrar..." 
                            className="border border-slate-300 rounded px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>

                    {/* Produto */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Produto</label>
                        <input value={filtroProd} onChange={e => setFiltroProd(e.target.value)} placeholder="Filtrar..."
                            className="border border-slate-300 rounded px-2 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>

                    {/* Recursos */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Recurso {selectedRecs.length > 0 && <span className="text-blue-600">({selectedRecs.length})</span>}
                        </label>
                        <details className="relative group">
                            <summary className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white cursor-pointer list-none flex items-center gap-2 w-52">
                                <span className="flex-1 truncate text-slate-600">
                                    {selectedRecs.length === 0 ? 'Todos' : `${selectedRecs.length} selecionado(s)`}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            </summary>
                            <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-56 overflow-y-auto w-64">
                                {selectedRecs.length > 0 && (
                                    <div className="px-3 py-1.5 border-b border-slate-100">
                                        <button onClick={() => setSelectedRecs([])}
                                            className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1">
                                            <X className="w-3 h-3" /> Limpar seleção
                                        </button>
                                    </div>
                                )}
                                {recursos.map(r => (
                                    <label key={r} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                                        <input type="checkbox" checked={selectedRecs.includes(r)} onChange={() => toggleRec(r)}
                                            className="accent-[#1E3A5F]" />
                                        <span className="truncate"><strong className="text-slate-700">{r}</strong>{nomeMap[r] ? ` — ${nomeMap[r]}` : ''}</span>
                                    </label>
                                ))}
                            </div>
                        </details>
                    </div>


                    {/* Cliente */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Cliente {selectedClis.length > 0 && <span className="text-blue-600">({selectedClis.length})</span>}
                        </label>
                        <details className="relative group">
                            <summary className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white cursor-pointer list-none flex items-center gap-2 w-44">
                                <span className="flex-1 truncate text-slate-600">
                                    {selectedClis.length === 0 ? 'Todos' : `${selectedClis.length} selecionados`}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            </summary>
                            <div className="absolute z-50 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto w-64">
                                {allClientes.map(c => (
                                    <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                                        <input type="checkbox" checked={selectedClis.includes(c)} onChange={() => toggleCli(c)}
                                            className="accent-[#1E3A5F]" />
                                        <span className="truncate">{c}</span>
                                    </label>
                                ))}
                            </div>
                        </details>
                    </div>

                    {/* Dias úteis: Sábado / Domingo */}
                    <div className="flex flex-col gap-1 self-end pb-0.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Capacidade</label>
                        <div className="flex flex-col gap-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none">
                                <input type="checkbox" checked={inclSabado} onChange={e => setInclSabado(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-[#1E3A5F] cursor-pointer" />
                                <span>Incl. Sábado</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none">
                                <input type="checkbox" checked={inclDomingo} onChange={e => setInclDomingo(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-[#1E3A5F] cursor-pointer" />
                                <span>Incl. Domingo</span>
                            </label>
                        </div>
                    </div>

                    {/* Limpar tudo */}

                    {(selectedClis.length > 0 || filtroPedido || filtroProd || periodoIni || periodoFim) && (
                        <button onClick={() => { setSelectedClis([]); setFiltroPedido(''); setFiltroProd(''); setPeriodoIni(''); setPeriodoFim(''); }}
                            className="self-end text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1.5 transition-colors">
                            Limpar Filtros
                        </button>
                    )}
                </div>

                {/* Resumo da seleção + Toggle */}
                <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{rowsFiltradas.length}</span> OPs filtradas •{' '}
                        <span className="font-semibold text-slate-700">{recursosVisiveis.length}</span> recursos •{' '}
                        <span className="font-semibold text-slate-700">{buckets.length}</span> período(s)
                    </div>
                    <div className="flex gap-1 border border-slate-200 rounded overflow-hidden">
                        <button onClick={() => setViewMode('total')}
                            className={`px-3 py-1 text-xs font-semibold transition-colors ${
                                viewMode === 'total' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}>
                            📅 Total/Mês
                        </button>
                        <button onClick={() => setViewMode('consolidado')}
                            className={`px-3 py-1 text-xs font-semibold transition-colors ${
                                viewMode === 'consolidado' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}>
                            📈 Consolidado
                        </button>
                        <button onClick={() => setViewMode('chart')}
                            className={`px-3 py-1 text-xs font-semibold transition-colors ${
                                viewMode === 'chart' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}>
                            📊 Por Recurso
                        </button>
                        <button onClick={() => setViewMode('table')}
                            className={`px-3 py-1 text-xs font-semibold transition-colors ${
                                viewMode === 'table' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}>
                            📋 Tabela
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CONTEÚDO ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto">
                {buckets.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        Nenhum dado para os filtros selecionados. Verifique se os itens possuem Data PCP preenchida.
                    </div>
                ) : viewMode === 'total' ? (
                    // ── MODO TOTAL/MÊS: um único gráfico macro, todos os recursos somados ──
                    <TotalMesChart
                        recursosVisiveis={recursosVisiveis}
                        buckets={buckets}
                        matrix={matrix}
                        capacidades={capacidades}
                        agrupamento={agrupamento}
                        workingDaysInBucket={workingDaysInBucket}
                    />
                ) : viewMode === 'consolidado' ? (
                    // ── MODO CONSOLIDADO: único gráfico, recursos no X, meses como grupos ──
                    <ConsolidadoChart
                        recursosVisiveis={recursosVisiveis}
                        buckets={buckets}
                        matrix={matrix}
                        nomeMap={nomeMap}
                        capacidades={capacidades}
                        agrupamento={agrupamento}
                        workingDaysInBucket={workingDaysInBucket}
                    />
                ) : viewMode === 'chart' ? (
                    // ── MODO GRÁFICO (por recurso) ────────────────────────

                    <div className="p-4 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                        {recursosVisiveis.map(r => {
                            const capDia = capacidades[(r || '').trim().toUpperCase()] || 0;
                            const seriesData = buckets.map(b => ({
                                label: formatBucketLabel(b, agrupamento),
                                capacidade: capDia * workingDaysInBucket(b, agrupamento),
                                previsto: matrix[r]?.[b]?.previsto || 0,
                                apontado: matrix[r]?.[b]?.apontado || 0,
                            }));
                            const hasAny = seriesData.some(d => d.previsto > 0 || d.apontado > 0);
                            if (!hasAny) return null;

                            // Escala baseada APENAS em previsto/apontado — capacidade vira linha de referência
                            const maxVal = Math.max(...seriesData.map(d => Math.max(d.previsto, d.apontado)), 1);

                            const totalPrev = seriesData.reduce((s, d) => s + d.previsto, 0);
                            const totalApon = seriesData.reduce((s, d) => s + d.apontado, 0);
                            const totalCap  = seriesData.reduce((s, d) => s + d.capacidade, 0);
                            const pctExec = totalPrev > 0 ? Math.min(100, (totalApon / totalPrev) * 100) : 0;
                            const pctCarga = totalCap > 0 ? Math.min(100, (totalPrev / totalCap) * 100) : 0;
                            const pctColor = pctExec >= 80 ? '#10b981' : pctExec >= 40 ? '#f59e0b' : '#ef4444';
                            const cargaColor = pctCarga >= 90 ? '#ef4444' : pctCarga >= 70 ? '#f59e0b' : '#6366f1';

                            const CHART_H   = 150;
                            const BAR_W     = 14;
                            const GROUP_W   = BAR_W * 2 + 10;
                            const PAD_L     = 44; // espaço para labels do eixo Y
                            const CHART_W   = Math.max(seriesData.length * GROUP_W + PAD_L + 20, 320);


                            return (
                                <div key={r} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                                    {/* Header do card */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="font-bold text-sm text-[#1E3A5F]">{r}</div>
                                            <div className="text-xs text-slate-400 truncate max-w-[180px]">{nomeMap[r] || ''}</div>
                                        </div>
                                        <div className="text-right flex flex-col gap-1">
                                            <div className="text-[10px] text-slate-500">
                                                Ocupação: <span style={{ color: cargaColor, fontWeight: 700 }}>{pctCarga.toFixed(0)}%</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                Executado: <span style={{ color: pctColor, fontWeight: 700 }}>{pctExec.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SVG Bar Chart — 3 barras: Capacidade / Previsto (2 cores) / Executado */}
                                    <div>
                                        <svg viewBox={`0 0 ${CHART_W} ${CHART_H + 58}`} width="100%" style={{ display: 'block' }}>

                                            {/* Grid lines */}
                                            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                                                const y = 4 + CHART_H * (1 - pct);
                                                return (
                                                    <g key={pct}>
                                                        <line x1={PAD_L} y1={y} x2={CHART_W} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                                                        <text x={PAD_L - 4} y={y + 3} fontSize={8} fill="#94a3b8" textAnchor="end">
                                                            {(maxVal * pct / 60).toFixed(0)}h
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* Barras por período */}
                                            {seriesData.map((d, i) => {
                                                const x = PAD_L + 4 + i * GROUP_W;
                                                // usa o maxVal do escopo externo (previsto/apontado only)

                                                const hPrev = d.previsto > 0 ? Math.max(2, (d.previsto / maxVal) * CHART_H) : 0;
                                                const hApon = d.apontado > 0 ? Math.max(2, (d.apontado / maxVal) * CHART_H) : 0;
                                                // Capacidade: linha tracejada de referência (clamped ao topo se > maxVal)
                                                const capClamped = Math.min(d.capacidade, maxVal * 1.05); // cap visível
                                                const hCapLine = d.capacidade > 0 ? Math.min(CHART_H, (capClamped / maxVal) * CHART_H) : 0;
                                                const base  = 4 + CHART_H;

                                                // Previsto: azul normal; barra vermelha no topo se excede a capacidade
                                                const isOverloaded = d.capacidade > 0 && d.previsto > d.capacidade;
                                                const hCapRef = d.capacidade > 0 ? Math.min(CHART_H, (d.capacidade / maxVal) * CHART_H) : hPrev;
                                                const hPrevBlue = isOverloaded ? hCapRef : hPrev;
                                                const hPrevRed  = isOverloaded ? Math.max(0, hPrev - hCapRef) : 0;

                                                // Executado: verde ≥80% do previsto, âmbar 40-80%, vermelho <40%
                                                const execPct = d.previsto > 0 ? d.apontado / d.previsto : 0;
                                                const aponColor = execPct >= 0.8 ? '#10b981' : execPct >= 0.4 ? '#f59e0b' : '#ef4444';

                                                return (
                                                    <g key={i}>
                                                        {/* Linha tracejada de Capacidade */}
                                                        {hCapLine > 0 && (
                                                            <line
                                                                x1={x - 2} x2={x + BAR_W * 2 + 4}
                                                                y1={base - hCapLine} y2={base - hCapLine}
                                                                stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4,3"
                                                            />
                                                        )}
                                                        {/* Previsto — parte azul (dentro da cap) */}
                                                        {hPrevBlue > 0 && <rect x={x} y={base - hPrevBlue} width={BAR_W} height={hPrevBlue} fill="#60a5fa" rx={2} />}
                                                        {/* Previsto — parte vermelha (excedente) */}
                                                        {hPrevRed  > 0 && <rect x={x} y={base - hPrev}     width={BAR_W} height={hPrevRed}  fill="#ef4444" rx={2} />}
                                                        {/* Label Previsto no topo */}
                                                        {hPrev > 0 && (
                                                            <text
                                                                x={x + BAR_W / 2} y={base - hPrev - 4}
                                                                textAnchor="middle" fontSize={7}
                                                                fill={isOverloaded ? '#ef4444' : '#3b82f6'}
                                                                fontWeight="600"
                                                            >
                                                                {(d.previsto / 60).toFixed(0)}h
                                                            </text>
                                                        )}

                                                        {/* Executado — verde/âmbar/vermelho */}
                                                        {hApon > 0 && <rect x={x + BAR_W + 2} y={base - hApon} width={BAR_W} height={hApon} fill={aponColor} rx={2} />}
                                                        {/* Label Apontado no topo */}
                                                        {hApon > 0 && (
                                                            <text
                                                                x={x + BAR_W + 2 + BAR_W / 2} y={base - hApon - 4}
                                                                textAnchor="middle" fontSize={7}
                                                                fill={aponColor}
                                                                fontWeight="600"
                                                            >
                                                                {(d.apontado / 60).toFixed(0)}h
                                                            </text>
                                                        )}

                                                        {/* Label X (mês/período) */}
                                                        <text x={x + BAR_W + 1} y={base + 16} textAnchor="middle" fontSize={8} fill="#475569" fontWeight="500">{d.label}</text>
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>


                                    {/* Legenda */}
                                    <div className="flex gap-3 mt-1 justify-end flex-wrap">
                                        <div className="flex items-center gap-1">
                                            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3"/></svg>
                                            <span className="text-[10px] text-slate-500">Capacidade</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-sm" style={{ background: '#60a5fa' }} />
                                            <span className="text-[10px] text-slate-500">Previsto</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                                            <span className="text-[10px] text-slate-500">Executado</span>
                                        </div>
                                    </div>

                                    {/* Rodapé */}
                                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs text-center">
                                        <div>
                                            <div className="text-[9px] text-slate-400 uppercase">Cap. Total</div>
                                            <div className="font-semibold text-slate-500">{(totalCap/60).toFixed(0)}h</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-slate-400 uppercase">Previsto</div>
                                            {/* Previsto em vermelho se excede a capacidade total */}
                                            <div className="font-semibold" style={{ color: totalCap > 0 && totalPrev > totalCap ? '#ef4444' : '#3b82f6' }}>{(totalPrev/60).toFixed(0)}h</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] text-slate-400 uppercase">Executado</div>
                                            <div className="font-semibold" style={{ color: pctColor }}>{(totalApon/60).toFixed(0)}h</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // ── MODO TABELA (original) ──────────────────────────
                    <table className="w-full text-[12px] border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 bg-[#1E3A5F] text-white text-left border-r border-[#304C71] whitespace-nowrap min-w-[160px]">Recurso</th>
                                {buckets.map(b => (
                                    <th key={b} className="px-3 py-2 bg-[#1E3A5F] text-white text-center border-r border-[#304C71] whitespace-nowrap min-w-[120px]">
                                        {formatBucketLabel(b, agrupamento)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recursosVisiveis.map((r, idx) => {
                                const hasAnyData = buckets.some(b => (matrix[r]?.[b]?.previsto || 0) > 0 || (matrix[r]?.[b]?.apontado || 0) > 0);
                                if (!hasAnyData) return null;
                                return (
                                    <tr key={r} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                        <td className="px-3 py-2 border-b border-r border-slate-200 font-semibold text-[#1E3A5F] whitespace-nowrap">
                                            <div className="font-bold text-xs">{r}</div>
                                            <div className="text-[10px] text-slate-500 font-normal truncate max-w-[140px]">{nomeMap[r] || ''}</div>
                                        </td>
                                        {buckets.map(b => {
                                            const cell = matrix[r]?.[b] || { previsto: 0, apontado: 0 };
                                            const pct = cell.previsto > 0 ? Math.min(100, (cell.apontado / cell.previsto) * 100) : 0;
                                            const colors = getCellColor(cell.previsto, cell.apontado);
                                            if (!cell.previsto && !cell.apontado) {
                                                return <td key={b} className="px-2 py-2 border-b border-r border-slate-200 text-center text-slate-300">—</td>;
                                            }
                                            return (
                                                <td key={b} className={`px-2 py-2 border-b border-r border-slate-200 ${colors?.bg || ''}`}>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex justify-between"><span className="text-slate-500 text-[10px]">Prev</span><span className="font-mono font-semibold text-slate-700">{cell.previsto.toFixed(0)}</span></div>
                                                        <div className="flex justify-between"><span className="text-slate-500 text-[10px]">Apon</span><span className={`font-mono font-semibold ${colors?.text || 'text-slate-700'}`}>{cell.apontado.toFixed(0)}</span></div>
                                                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                            <div className={`h-1.5 rounded-full ${colors?.bar || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <div className={`text-[10px] text-center font-bold ${colors?.text || 'text-slate-500'}`}>{pct.toFixed(0)}%</div>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            <tr className="bg-[#1E3A5F] text-white sticky bottom-0">
                                <td className="px-3 py-2 font-bold text-xs border-r border-[#304C71]">TOTAL (min)</td>
                                {buckets.map(b => {
                                    const t = totaisPorBucket[b] || { previsto: 0, apontado: 0 };
                                    const pct = t.previsto > 0 ? Math.min(100, (t.apontado / t.previsto) * 100) : 0;
                                    return (
                                        <td key={b} className="px-2 py-2 text-center border-r border-[#304C71]">
                                            <div className="text-[10px] text-blue-200">Prev: {t.previsto.toFixed(0)}</div>
                                            <div className="text-[10px] text-emerald-300">Apon: {t.apontado.toFixed(0)}</div>
                                            <div className="text-[11px] font-bold mt-0.5">{pct.toFixed(0)}%</div>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default MasterSheetTab;
