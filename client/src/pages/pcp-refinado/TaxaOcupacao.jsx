import React, { useState, useEffect } from 'react';
import { Search, Activity, Calendar, Server, AlertTriangle, Edit2, Save, X } from 'lucide-react';
import api from '../../services/api';

const TaxaOcupacao = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [recursoBusca, setRecursoBusca] = useState('');
    const [error, setError] = useState('');
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [editingOp, setEditingOp] = useState(null);
    const [editDates, setEditDates] = useState({ inicio: '', fim: '' });
    
    // Novos estados do modal (Filtro e Seleção em Massa)
    const [modalSearchTerm, setModalSearchTerm] = useState('');
    const [selectedOps, setSelectedOps] = useState([]);
    const [bulkDates, setBulkDates] = useState({ inicio: '', fim: '' });
    
    // Estados do Histórico
    const [modalTab, setModalTab] = useState('ops'); // 'ops' | 'historico'
    const [historicoData, setHistoricoData] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = {};
            if (dataInicio) params.data_inicio = dataInicio;
            if (dataFim) params.data_fim = dataFim;
            if (recursoBusca) params.recurso = recursoBusca;
            
            const response = await api.get('/pcp-refinado/taxa-ocupacao', { params });
            setData(response.data);
            setError('');
            
            // Se o modal estiver aberto, atualiza os dados dele também
            if (selectedDetail) {
                const currentResource = response.data.find(d => d.data === selectedDetail.data);
                if (currentResource) {
                    const resData = currentResource[selectedDetail.recurso.recurso_codigo];
                    if (resData) setSelectedDetail({ data: selectedDetail.data, recurso: resData });
                }
            }
        } catch (err) {
            console.error('Erro ao buscar taxa de ocupação:', err);
            setError('Falha ao carregar os dados de ocupação. Verifique sua conexão e tente novamente.');
        } finally {
            setLoading(false);
        }
    };
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
                sequen: opObj.sequen
            });
            setEditingOp(null);
            fetchData();
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
            // Em produção real, você pode querer criar uma rota de bulk-update no backend.
            // Para simplificar, faremos requisições em paralelo.
            
            // Localiza as operacoes completas para enviar o codigo correto
            const opsToUpdate = selectedOps.map(opStr => {
                // Apenas busca no detalhamento atual
                return selectedDetail?.recurso?.ops?.find(o => o.op === opStr) || { op: opStr };
            });

            await Promise.all(opsToUpdate.map(opObj => 
                api.put(`/pcp-refinado/op/${opObj.op}/dates`, {
                    data_inicio: bulkDates.inicio.replace(/-/g, ''),
                    data_fim: bulkDates.fim.replace(/-/g, ''),
                    operacao_codigo: opObj.operacao,
                    item_op: opObj.item_op,
                    sequen: opObj.sequen
                })
            ));
            
            setSelectedOps([]);
            setBulkDates({ inicio: '', fim: '' });
            fetchData();
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
                    const dateStr = `${y}${m}${d}`;
                    
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

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Taxa de Ocupação Diária
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Análise de carga vs capacidade dos recursos (CRP).
                    </p>
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
                    <button 
                        onClick={fetchData}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        Filtrar
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Calculando demanda global...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {sortedDates.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500 p-6">
                                <Server className="w-12 h-12 mb-4 text-slate-300" />
                                <p>Nenhuma demanda planejada encontrada para os filtros atuais.</p>
                            </div>
                        </div>
                    ) : (
                        sortedDates.map(dateStr => (
                            <div key={dateStr} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-slate-50 border-b border-slate-100 py-3 px-6">
                                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-slate-400" />
                                        Data Início (Planejada): {formatDateBR(dateStr)}
                                    </h3>
                                </div>
                                <div className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left text-slate-600">
                                            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold w-1/3">Recurso / C.T.</th>
                                                    <th className="px-6 py-4 font-semibold text-center w-32">Capacidade (Min)</th>
                                                    <th className="px-6 py-4 font-semibold text-center w-32">Demanda (Min)</th>
                                                    <th className="px-6 py-4 font-semibold w-1/3">Ocupação</th>
                                                    <th className="px-6 py-4 font-semibold text-right">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {groupedByDate[dateStr].length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                                                            Nenhuma carga programada para iniciar neste dia.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    groupedByDate[dateStr].map(item => {
                                                    const isOverloaded = item.taxa_ocupacao > 100;
                                                    const displayPercent = item.taxa_ocupacao > 999 ? '> 999' : item.taxa_ocupacao.toFixed(1);
                                                    
                                                    // Limit bar to 100% for visual sanity
                                                    const barWidth = Math.min(item.taxa_ocupacao, 100);

                                                    return (
                                                        <tr key={item.recurso_codigo} className={`hover:bg-slate-50 transition-colors ${isOverloaded ? 'bg-red-50/30' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <div className="font-medium text-slate-800">{item.recurso_descri}</div>
                                                                <div className="text-xs text-slate-400 mt-0.5">Cod: {item.recurso_codigo}</div>
                                                            </td>
                                                            <td className="px-6 py-4 text-center font-medium">
                                                                {item.capacidade_diaria > 0 ? (
                                                                    item.capacidade_diaria.toLocaleString('pt-BR')
                                                                ) : (
                                                                    <span className="text-red-400 text-xs">Não Config.</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-center font-medium">
                                                                {item.minutos_consumidos.toLocaleString('pt-BR')}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-2">
                                                                    {/* CARGA PENDENTE */}
                                                                    <div className="flex items-center justify-between mt-1">
                                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getOccupationColor(item.taxa_ocupacao)} shadow-sm`}>
                                                                            Carga: {displayPercent}%
                                                                        </span>
                                                                        {isOverloaded && (
                                                                            <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Gargalo</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 shadow-inner overflow-hidden mb-2">
                                                                        <div 
                                                                            className={`h-1.5 rounded-full transition-all duration-500 ${getProgressColor(item.taxa_ocupacao)}`}
                                                                            style={{ width: `${barWidth}%` }}
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
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODAL DETALHAMENTO */}
            {selectedDetail && (() => {
                // Filtra as OPs localmente pelo termo de busca
                const filteredOps = (selectedDetail.recurso.ops || []).filter(o => 
                    o.op.toLowerCase().includes(modalSearchTerm.toLowerCase()) || 
                    (o.pedido || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                    (o.cliente || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                    (o.produto || '').toLowerCase().includes(modalSearchTerm.toLowerCase())
                );

                const isAllSelected = filteredOps.length > 0 && selectedOps.length === filteredOps.length;

                const toggleSelectAll = () => {
                    if (isAllSelected) {
                        setSelectedOps([]);
                    } else {
                        setSelectedOps(filteredOps.map(o => o.op));
                    }
                };

                const toggleSelectOp = (op) => {
                    if (selectedOps.includes(op)) {
                        setSelectedOps(selectedOps.filter(id => id !== op));
                    } else {
                        setSelectedOps([...selectedOps, op]);
                    }
                };

                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    Detalhamento de Carga
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {selectedDetail.recurso.recurso_descri} ({selectedDetail.recurso.recurso_codigo}) - Data: {formatDateBR(selectedDetail.data)}
                                </p>
                            </div>
                            
                            {/* Barra de Busca de OP/Pedido/Cliente */}
                            <div className="relative w-72 mx-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar OP, Pedido, Cliente ou Produto..."
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
                                            if (bulkDates.fim && bulkDates.fim < newInicio) {
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
                        
                        <div className="p-6 overflow-y-auto flex-1">
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
                                        <th className="px-4 py-3 font-semibold text-center">Fim Planejado</th>
                                        <th className="px-4 py-3 font-semibold text-right">Qtd. Pendente</th>
                                        <th className="px-4 py-3 font-semibold text-right">Carga Estimada</th>
                                        <th className="px-4 py-3 font-semibold text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredOps.length > 0 ? (
                                        filteredOps.map((opItem, idx) => {
                                            const isEditing = editingOp === opItem.op;
                                            const isChecked = selectedOps.includes(opItem.op);
                                            
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
                                                        onChange={() => toggleSelectOp(opItem.op)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-800">{opItem.op}</td>
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
                                                                const updates = { inicio: newInicio };
                                                                if (editDates.fim && editDates.fim < newInicio) {
                                                                    updates.fim = newInicio;
                                                                }
                                                                setEditDates(prev => ({ ...prev, ...updates }));
                                                            }}
                                                        />
                                                    ) : (
                                                        formatDateBR(opItem.data_planejada)
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {isEditing ? (
                                                        <input 
                                                            type="date" 
                                                            className="px-2 py-1 border border-blue-300 rounded text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            value={editDates.fim}
                                                            onChange={e => setEditDates({...editDates, fim: e.target.value})}
                                                        />
                                                    ) : (
                                                        formatDateBR(opItem.data_planejada_final)
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-right font-medium text-blue-600">{opItem.qtde_pendente}</td>
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
                                                                setEditingOp(opItem.op);
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
                            </table>
                            ) : (
                            <div className="space-y-4">
                                {loadingHistorico ? (
                                    <div className="text-center py-8 text-slate-500">Carregando histórico...</div>
                                ) : historicoData.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">Nenhum histórico de alteração encontrado.</div>
                                ) : (
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
                                            {historicoData.map(hist => (
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
                                )}
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
