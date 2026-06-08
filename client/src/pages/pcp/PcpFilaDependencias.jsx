import React, { useState, useEffect } from 'react';
import { Search, Factory, ArrowDownRight, ArrowUpRight, Calendar as CalendarIcon, Filter, Info, Search as SearchIcon, FileText, Printer, CheckCircle, AlertOctagon, AlertTriangle, Clock } from 'lucide-react';
import api, { getProductDocuments, getFileUrl } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { format, addDays, endOfWeek, endOfMonth } from 'date-fns';
import RecursoLegendModal from '../../components/RecursoLegendModal';

const PcpFilaDependencias = () => {
    const { user } = useAuth();
    
    const [recurso, setRecurso] = useState('');
    const [showRecursoModal, setShowRecursoModal] = useState(false);
    const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [dateFilterType, setDateFilterType] = useState('hoje');
    
    const [loading, setLoading] = useState(false);
    const [inbound, setInbound] = useState([]);
    const [outbound, setOutbound] = useState([]);
    
    const [activeTab, setActiveTab] = useState('inbound');

    const [filtroPedido, setFiltroPedido] = useState('');
    const [filtroOp, setFiltroOp] = useState('');
    const [filtroCliente, setFiltroCliente] = useState('');
    const [filtroProduto, setFiltroProduto] = useState('');
    const [filtroSetor, setFiltroSetor] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('todos');
    
    const [productDocs, setProductDocs] = useState({});

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 500;

    useEffect(() => {
        setCurrentPage(1);
    }, [inbound, outbound, activeTab, filtroPedido, filtroOp, filtroCliente, filtroProduto, filtroSetor, filtroStatus]);

    // Fetch PDF docs para produtos listados na fila
    useEffect(() => {
        const allOps = [...inbound, ...outbound];
        if (allOps.length === 0) return;
        
        const uniqueCodes = [...new Set(allOps.map(o => (o.cod_produto || '').trim()).filter(Boolean))];
        const toFetch = uniqueCodes.filter(c => !(c in productDocs));
        if (toFetch.length === 0) return;

        setProductDocs(prev => {
            const next = { ...prev };
            toFetch.forEach(c => { if (!(c in next)) next[c] = null; });
            return next;
        });

        toFetch.forEach(async (codigo) => {
            try {
                const docs = await getProductDocuments(codigo);
                const drawing = Array.isArray(docs) ? docs.find(d => d.tipo === 'Desenho' || d.tipo === 'PDF') || docs[0] : null;
                setProductDocs(prev => ({
                    ...prev,
                    [codigo]: drawing ? { hasDoc: true, url: drawing.url_arquivo || drawing.caminho || null } : { hasDoc: false, url: null }
                }));
            } catch {
                setProductDocs(prev => ({ ...prev, [codigo]: { hasDoc: false, url: null } }));
            }
        });
    }, [inbound, outbound]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!recurso) {
            toast.warning('Por favor, informe um recurso (ex: MO0013).');
            return;
        }

        setLoading(true);
        try {
            const res = await api.get('/pcp-setores/fila-dependencias', {
                params: {
                    recurso: recurso.toUpperCase(),
                    data_fim: dataFim
                }
            });
            setInbound(res.data.inbound || []);
            setOutbound(res.data.outbound || []);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao buscar fila de dependências.');
        } finally {
            setLoading(false);
        }
    };

    const getFilteredData = (list) => {
        return list.filter(op => {
            const prodFilt = filtroProduto.trim().toUpperCase();
            const clienteFilt = filtroCliente.trim().toUpperCase();
            const setorFilt = filtroSetor.trim().toUpperCase();
            const pedFilters = filtroPedido.trim().toUpperCase().split(',').map(s => s.trim().replace(/\s/g, '')).filter(Boolean);
            const opFilters = filtroOp.trim().toUpperCase().split(',').map(s => s.trim().replace(/\s/g, '')).filter(Boolean);
            
            const matchProd = !prodFilt || (op.cod_produto || '').toUpperCase().includes(prodFilt) || (op.desc_produto || '').toUpperCase().includes(prodFilt);
            const matchCliente = !clienteFilt || (op.nome_cliente || '').toUpperCase().includes(clienteFilt);
            const matchSetor = !setorFilt || (op.recurso_referencia || '').toUpperCase().includes(setorFilt) || (op.desc_recurso_referencia || '').toUpperCase().includes(setorFilt);
            
            const pvRaw = (op.pedido_venda || '').toUpperCase().replace(/\s/g, '');
            const matchPed = pedFilters.length === 0 || pedFilters.some(pf => pvRaw.includes(pf));
            
            const opRaw = (op.op || '').toUpperCase().replace(/\s/g, '');
            const matchOp = opFilters.length === 0 || opFilters.some(of => opRaw.includes(of));
            
            let matchStatus = true;
            if (filtroStatus !== 'todos') {
                const statusInfo = getOpStatus(op);
                if (filtroStatus === 'Atrasada') {
                    matchStatus = statusInfo.text.includes('Atrasada');
                } else if (filtroStatus === 'Planejada') {
                    matchStatus = statusInfo.text.includes('Planejada') || statusInfo.text.includes('Aguardando');
                } else {
                    matchStatus = statusInfo.text === filtroStatus;
                }
            }
            
            return matchProd && matchCliente && matchSetor && matchPed && matchOp && matchStatus;
        });
    };

    const getOpStatus = (op) => {
        const now = new Date();
        
        const parseDate = (dStr) => {
            if (!dStr || dStr.length !== 8) return null;
            return new Date(`${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}T12:00:00`);
        };

        const start = parseDate(op.data_planejada);
        let end = parseDate(op.data_fim_planejada);
        if (end) end.setHours(23, 59, 59, 999);

        const done = Math.round(op.qtd_pendente || 0) <= 0 || Number(op.qtd_apontada) >= Number(op.qtd_total);
        const started = Number(op.qtd_apontada) > 0;

        if (done) return { text: 'Concluída', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700 border border-green-300' };
        if (end && now > end) return { text: 'Atrasada (Entrega)', icon: <AlertOctagon className="w-3 h-3" />, color: 'bg-red-100 text-red-700 border border-red-300' };
        if (start && now > start && !started) return { text: 'Atrasada (Início)', icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-orange-100 text-orange-700 border border-orange-300' };
        if (started) return { text: 'Em Andamento', icon: <Clock className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700 border border-blue-300' };
        if (start && end) return { text: 'Planejada', icon: <CalendarIcon className="w-3 h-3" />, color: 'bg-slate-100 text-slate-700 border border-slate-300' };
        return { text: 'Aguardando', icon: <Clock className="w-3 h-3" />, color: 'bg-gray-100 text-gray-600 border border-gray-300' };
    };

    return (
        <div className="flex flex-col bg-slate-50/50 h-[calc(100vh-5rem)] md:h-[calc(100vh-2.5rem)] overflow-hidden print:bg-white print:block print:overflow-visible relative">
            <style type="text/css" media="print">{`@page { size: A4 landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
            {/* Header Fixed Area */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Factory className="h-6 w-6 text-blue-600" />
                        Fila e dependências por Recurso
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gerencie a fila de WIP (Work In Progress): O que estão lhe devendo (Gargalos) e o que você deve entregar.
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0 shadow-sm z-10">
                <div className="flex flex-col xl:flex-row gap-6 xl:items-end justify-between">
                    {/* Filtros de Consulta (Backend) */}
                    <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
                        <div className="w-full sm:w-64">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                Recurso de Consulta
                            </label>
                            <div className="relative flex shadow-sm rounded-lg">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase transition-all bg-slate-50 focus:bg-white"
                                        placeholder="Ex: MO0013"
                                        value={recurso}
                                        onChange={(e) => setRecurso(e.target.value)}
                                    />
                                    <Factory className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowRecursoModal(true)}
                                    className="px-4 bg-slate-100 hover:bg-slate-200 border border-l-0 border-slate-300 rounded-r-lg text-slate-600 transition-colors flex items-center justify-center font-medium text-sm"
                                    title="Selecionar da Lista de Recursos"
                                >
                                    <SearchIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="w-full sm:w-48">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                Período de Visão
                            </label>
                            <div className="relative shadow-sm rounded-lg">
                                <select
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-slate-50 focus:bg-white transition-all text-sm font-medium text-slate-700"
                                    value={dateFilterType}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setDateFilterType(val);
                                        if (val === 'hoje') setDataFim(format(new Date(), 'yyyy-MM-dd'));
                                        else if (val === 'amanha') setDataFim(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
                                        else if (val === 'semana') setDataFim(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
                                        else if (val === 'mes') setDataFim(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                                        else if (val === 'todas') setDataFim('2099-12-31');
                                    }}
                                >
                                    <option value="hoje">Até Hoje</option>
                                    <option value="amanha">Até Amanhã</option>
                                    <option value="semana">Até Fim da Semana</option>
                                    <option value="mes">Até Fim do Mês</option>
                                    <option value="todas">Ver Tudo</option>
                                    <option value="custom">Data Específica...</option>
                                </select>
                                <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            </div>
                        </div>

                        {dateFilterType === 'custom' && (
                            <div className="w-full sm:w-36">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Até Data
                                </label>
                                <div className="relative shadow-sm rounded-lg">
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 focus:bg-white transition-all"
                                        value={dataFim}
                                        onChange={(e) => setDataFim(e.target.value)}
                                    />
                                    <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            Consultar
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 ml-auto"
                            title="Imprimir Relatório"
                        >
                            <Printer className="h-4 w-4" />
                            Imprimir
                        </button>
                    </form>

                    {/* Filtros em memória (Frontend) */}
                    <div className="flex flex-wrap items-center gap-3 pt-4 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                        <div className="flex items-center text-sm font-semibold text-slate-500 mr-1">
                            <Filter className="h-4 w-4 mr-1.5" /> Refinar:
                        </div>
                        <div className="w-full sm:w-36 relative">
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase bg-slate-50 transition-all"
                                placeholder="OP..."
                                value={filtroOp}
                                onChange={(e) => setFiltroOp(e.target.value)}
                            />
                            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        <div className="w-full sm:w-36 relative">
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase bg-slate-50 transition-all"
                                placeholder="Pedido..."
                                value={filtroPedido}
                                onChange={(e) => setFiltroPedido(e.target.value)}
                            />
                            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        <div className="w-full sm:w-36 relative">
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase bg-slate-50 transition-all"
                                placeholder="Cliente..."
                                value={filtroCliente}
                                onChange={(e) => setFiltroCliente(e.target.value)}
                            />
                            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        <div className="w-full sm:w-36 relative">
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase bg-slate-50 transition-all"
                                placeholder="Produto..."
                                value={filtroProduto}
                                onChange={(e) => setFiltroProduto(e.target.value)}
                            />
                            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        <div className="w-full sm:w-36 relative">
                            <input
                                type="text"
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase bg-slate-50 transition-all"
                                placeholder="Setor Orig/Dest..."
                                value={filtroSetor}
                                onChange={(e) => setFiltroSetor(e.target.value)}
                            />
                            <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                        <div className="w-full sm:w-40 relative">
                            <select
                                className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 transition-all appearance-none"
                                value={filtroStatus}
                                onChange={(e) => setFiltroStatus(e.target.value)}
                            >
                                <option value="todos">Status: Todos</option>
                                <option value="Atrasada">Atrasadas</option>
                                <option value="Em Andamento">Em Andamento</option>
                                <option value="Planejada">Planejadas / Aguardando</option>
                                <option value="Concluída">Concluídas</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:block mb-8 text-center pt-8">
                <h1 className="text-3xl font-extrabold uppercase mb-2 text-slate-900">
                    Fila de dependências - <span className="text-blue-700">{recurso || 'Todos'}</span>
                </h1>
                <h2 className={`text-xl font-bold uppercase tracking-widest ${activeTab === 'inbound' ? 'text-red-700' : 'text-amber-700'}`}>
                    {activeTab === 'inbound' ? '▼ Entrada (estão devendo)' : '▲ Saída (Estou devendo)'}
                </h2>
                <div className="text-sm text-slate-500 mt-3 font-medium">Data Limite de Planejamento: {dataFim}</div>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden print:overflow-visible print:p-0">
                <div className="flex gap-4 border-b border-slate-200 mb-6 shrink-0 print:hidden">
                    <button
                        onClick={() => setActiveTab('inbound')}
                        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors relative ${
                            activeTab === 'inbound' 
                                ? 'text-blue-700' 
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <ArrowDownRight className={`h-5 w-5 ${activeTab === 'inbound' ? 'text-blue-600' : ''}`} />
                        O que estão me devendo (Entrada)
                        <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
                            {inbound.length}
                        </span>
                        {activeTab === 'inbound' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-lg" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('outbound')}
                        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors relative ${
                            activeTab === 'outbound' 
                                ? 'text-amber-700' 
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <ArrowUpRight className={`h-5 w-5 ${activeTab === 'outbound' ? 'text-amber-600' : ''}`} />
                        O que eu estou devendo (Saída)
                        <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">
                            {outbound.length}
                        </span>
                        {activeTab === 'outbound' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-600 rounded-t-lg" />
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-auto min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 print:overflow-visible print:h-auto print:border-none print:shadow-none">
                    <table className="w-full text-left text-sm text-slate-600 print:text-[10px]">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs sticky top-0 z-10 print:static print:bg-slate-100">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">Pedido Venda</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">Cliente</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">Ordem de Produção</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">Produto</th>
                                <th className="px-4 py-3 border-b border-slate-200 text-center w-10 print:hidden">PDF</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">Status</th>
                                <th className="px-4 py-3 border-b border-slate-200 text-right text-red-600 print:px-2">Qtd. Pendente</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">Período Plan.</th>
                                <th className="px-4 py-3 border-b border-slate-200 text-center print:px-2">Apontamentos</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:px-2">
                                    {activeTab === 'inbound' ? 'Depende de (Origem)' : 'Próxima Fila (Destino)'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                            {(() => {
                                const fullData = getFilteredData(activeTab === 'inbound' ? inbound : outbound);
                                const totalPages = Math.ceil(fullData.length / itemsPerPage) || 1;
                                const paginatedData = fullData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                                if (fullData.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                                                Nenhuma OP encontrada na aba {activeTab === 'inbound' ? 'Entrada' : 'Saída'} com os filtros atuais.
                                            </td>
                                        </tr>
                                    );
                                }

                                return paginatedData.map((op, idx) => {
                                    const st = getOpStatus(op);
                                    const codigoStr = (op.cod_produto || '').trim();
                                    const docInfo = productDocs[codigoStr];
                                    const fmtDate = (d) => d && d.length === 8 ? `${d.substring(6,8)}/${d.substring(4,6)}/${d.substring(0,4)}` : (d || '-');
                                    return (
                                        <tr key={`${op.op}-${op.item_op}-${op.sequen}-${idx}`} className="hover:bg-slate-50 transition-colors print:break-inside-avoid">
                                            <td className="px-4 py-3 print:px-2">
                                                {op.pedido_venda ? (
                                                    <div className="text-sm text-slate-700 font-medium">{op.pedido_venda} <span className="text-xs text-slate-500">/ {op.item_pv}</span></div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 print:px-2">
                                                {op.pedido_venda ? (
                                                    <div className="font-medium text-slate-800 truncate max-w-[150px] print:max-w-none print:whitespace-normal" title={op.nome_cliente}>{op.nome_cliente || 'N/A'}</div>
                                                ) : (
                                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded print:border print:border-slate-300">OP de Estoque</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap print:px-2">
                                                <div className="font-bold text-slate-900 print:text-sm">{op.op}</div>
                                                <div className="text-xs text-slate-500">Item {op.item_op} Seq {op.sequen}</div>
                                            </td>
                                            <td className="px-4 py-3 print:px-2">
                                                <div className="font-medium text-slate-800">{op.cod_produto}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[200px] print:max-w-none print:whitespace-normal" title={op.desc_produto}>{op.desc_produto}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center print:hidden">
                                                {docInfo?.hasDoc && docInfo?.url ? (
                                                    <button onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(docInfo.url)}`), '_blank')} className="p-1.5 rounded hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-200 transition-all group" title="Abrir Desenho/PDF">
                                                        <FileText className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                                                    </button>
                                                ) : (
                                                    <FileText className="w-4 h-4 text-slate-300 mx-auto" title="Sem PDF associado" />
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap print:px-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold print:border print:border-slate-300 print:bg-transparent print:text-slate-800 ${st.color}`}>
                                                    {st.icon}{st.text}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-red-600 text-base print:px-2 print:text-black">
                                                {Math.round(op.qtd_pendente || 0)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap print:px-2">
                                                <div className="text-xs text-slate-800 font-medium mb-0.5">Início: {fmtDate(op.data_planejada)}</div>
                                                <div className="text-xs text-slate-500">Fim: {fmtDate(op.data_fim_planejada)}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center align-middle print:px-2">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1 max-w-[80px] print:hidden">
                                                        <div className={`h-1.5 rounded-full ${op.qtd_apontada > 0 ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, (op.qtd_apontada / op.qtd_total) * 100 || 0)}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">{Math.round(op.qtd_apontada || 0)} de {Math.round(op.qtd_total || 0)}</span>
                                                    {(op.ultimo_usuario || op.ultimo_apontamento_data) && (
                                                        <div className="mt-1 text-[9px] text-slate-400 font-medium tracking-tight">
                                                            {op.ultimo_usuario ? op.ultimo_usuario.split(' ')[0] : ''}
                                                            {op.ultimo_apontamento_data ? ` • ${new Date(op.ultimo_apontamento_data).toLocaleDateString('pt-BR')}` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 print:px-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold print:border-none ${activeTab === 'inbound' ? 'bg-red-50 text-red-700 border border-red-200 print:text-black' : 'bg-amber-50 text-amber-700 border border-amber-200 print:text-black'}`}>{op.recurso_referencia}</span>
                                                    <span className="text-xs text-slate-600 truncate max-w-[120px] print:max-w-none print:whitespace-normal" title={op.desc_recurso_referencia}>{op.desc_recurso_referencia}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {(() => {
                    const fullData = getFilteredData(activeTab === 'inbound' ? inbound : outbound);
                    const totalPages = Math.ceil(fullData.length / itemsPerPage) || 1;
                    if (totalPages <= 1) return null;
                    return (
                        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 mt-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
                            <p className="text-sm text-slate-700">
                                Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, fullData.length)}</span> de <span className="font-medium">{fullData.length}</span> resultados
                            </p>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300">
                                    {currentPage} / {totalPages}
                                </span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                                </button>
                            </nav>
                        </div>
                    );
                })()}
            </div>
            {showRecursoModal && (
                <RecursoLegendModal
                    onClose={() => setShowRecursoModal(false)}
                    onSelect={(cod) => {
                        setRecurso(cod);
                        setShowRecursoModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default PcpFilaDependencias;

