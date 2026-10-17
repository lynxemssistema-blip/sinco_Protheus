import React, { useState, useEffect, useCallback } from 'react';
import {
    getFaturamentoSolicitacoes,
    getFaturamentoAuditoria,
    enviarFaturamentoEmailLote,
    updateFaturamentoSolicitacaoStatus,
    updateFaturamentoSolicitacaoNotaFiscal,
    updateFaturamentoSolicitacaoItem,
    deleteFaturamentoSolicitacaoItem,
    insertFaturamentoSolicitacaoItem,
    getPedidosFlat,
    getProductDocs,
    getFileUrl,
    getFaturamentoDashboard
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useHelp } from '../contexts/HelpContext';
import { 
    FileText, History, Clock, CheckCircle, Eye, Download, XCircle, Trash2, CheckCircle2, 
    Save, AlertTriangle, Plus, Search, X, DollarSign, TrendingUp, Users, Target, Lock, RefreshCw, Calendar,
    HelpCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import generateFaturamentoPdf from '../services/faturamentoPdfGenerator';
import generateFaturamentosExcel from '../services/faturamentoExcelGenerator';
import useStickyState from '../hooks/useStickyState';
import { format, subDays, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';

const ControleFaturamento = () => {
    const { user, hasPermission } = useAuth();
    const { openHelp } = useHelp();
    const canViewFinancials = hasPermission('valores_financeiros', 'view');

    const [activeTab, setActiveTab] = useState('gestao'); // 'gestao' | 'financeiro'

    const [solicitacoes, setSolicitacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
    const [auditoria, setAuditoria] = useState([]);

    // Bloqueio de Edição para Faturados
    const faturadoLog = auditoria.find(log => log.acao === 'ALTERACAO_STATUS' && log.detalhes && log.detalhes.includes('Atendido'));
    const faturadoPor = faturadoLog ? faturadoLog.usuario : null;
    const isLockedFaturado = selectedSolicitacao?.status === 'Atendido' && user?.nome !== faturadoPor;

    // Filtros
    const [statusFilter, setStatusFilter] = useStickyState('Pendente', '@lynxems:controleFat_status');

    // Estados da Visão Financeira
    const [finFilters, setFinFilters] = useState({
        dataInicial: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
        dataFinal:   format(new Date(), 'yyyy-MM-dd'),
        cliente:     '',
    });
    const [finPeriodPreset, setFinPeriodPreset] = useState('3m');
    const [finPeriodGroupBy, setFinPeriodGroupBy] = useState('dia'); // 'dia' | 'semana' | 'mes'
    const [clientData, setClientData] = useState(null);
    const [periodData, setPeriodData] = useState(null);
    const [finLoading, setFinLoading] = useState(false);

    // UI States
    const [globalNf, setGlobalNf] = useState('');
    const [savingNf, setSavingNf] = useState(false);

    // Novas features audio (checks & configs)
    const [itemChecks, setItemChecks] = useState([]);
    const [pdfStatus, setPdfStatus] = useState({});

    // Multiselection
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectedRow, setSelectedRow] = useState(null);
    const [loadingEmail, setLoadingEmail] = useState(false);

    // Modal Add Item
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addSearchText, setAddSearchText] = useState('');
    const [addSearchResults, setAddSearchResults] = useState([]);
    const [isAddSearching, setIsAddSearching] = useState(false);
    const [candidateItem, setCandidateItem] = useState(null);
    const [addQtdForm, setAddQtdForm] = useState('');

    const formatCurrency = (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return '-';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    };

    useEffect(() => {
        fetchSolicitacoes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    useEffect(() => {
        if (selectedSolicitacao?.itens) {
            setItemChecks([]); // Reseta checks ao mudar fatura
            const checkPdfs = async () => {
                const uniqueCodes = [...new Set(selectedSolicitacao.itens.map(i => i.codigo_produto))];
                const newStatus = { ...pdfStatus };
                for (const code of uniqueCodes) {
                    if (newStatus[code] === undefined) {
                        try {
                            const res = await getProductDocs(code);
                            newStatus[code] = res.docs && res.docs.length > 0 ? res.docs[0].url_arquivo : false;
                        } catch(e) { newStatus[code] = false; }
                    }
                }
                setPdfStatus(newStatus);
            };
            checkPdfs();
        }
    }, [selectedSolicitacao]);

    const fetchSolicitacoes = async () => {
        setLoading(true);
        try {
            const res = await getFaturamentoSolicitacoes({ limit: 100, page: 1, status: statusFilter });
            setSolicitacoes(res.data || []);
            // Update selected if open
            if (selectedSolicitacao) {
                const updated = res.data.find(s => s.id === selectedSolicitacao.id);
                if (updated) setSelectedSolicitacao(updated);
                else setSelectedSolicitacao(null);
            }
        } catch (err) {
            toast.error('Erro ao carregar solicitações.');
        } finally {
            setLoading(false);
        }
    };

    const loadAuditoria = async (id) => {
        try {
            const res = await getFaturamentoAuditoria(id);
            setAuditoria(res);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelect = (solicitacao) => {
        setSelectedSolicitacao(solicitacao);
        setGlobalNf(solicitacao.nota_fiscal || '');
        loadAuditoria(solicitacao.id);
    };

    const TranslateAcao = (acao, detalhes) => {
        switch(acao) {
            case 'CRIACAO': return `Criou a solicitação com ${detalhes?.qtd_itens || 0} itens.`;
            case 'ALTERACAO_ITEM': return `Alterou a quantidade do item de ${detalhes?.qtd_de} para ${detalhes?.qtd_para}.`;
            case 'EXCLUSAO_ITEM': return `Removeu o produto ${detalhes?.codigo} (Ped: ${detalhes?.pedido}-${detalhes?.item}).`;
            case 'INCLUSAO_ITEM': return `Inseriu produto ${detalhes?.codigo} (Qtd: ${detalhes?.qtd}).`;
            case 'VINCULO_NF': return `Vinculou Nota Fiscal Global: ${detalhes?.nota_fiscal}.`;
            case 'VINCULO_NF_ITEM': return `Alterou a Nota Fiscal do item de ${detalhes?.nf_de || 'N/D'} para ${detalhes?.nf_para}.`;
            default: return acao;
        }
    };

    // SEARCH NEW ITEMS
    const handleSearchAdd = async () => {
        if(addSearchText.length < 3) {
            toast.warning("Digite ao menos 3 caracteres (Pedido, Cliente ou Produto)");
            return;
        }
        setIsAddSearching(true);
        setCandidateItem(null);
        try {
            const res = await getPedidosFlat({ pedido: addSearchText, limit: 15, page: 1, only_active: 'true' });
            setAddSearchResults(res.data || []);
        } catch(err) {
            toast.error("Erro ao buscar base do Protheus.");
        } finally {
            setIsAddSearching(false);
        }
    };

    const handleConfirmAddItem = async () => {
        if(isLockedFaturado) return toast.error("Apenas o usuário que mudou para 'Faturado' pode alterar itens.");
        if(!candidateItem) return;
        if(!addQtdForm || addQtdForm <= 0) return toast.warning('Quantidade inválida.');
        if(addQtdForm > candidateItem.qtd_faturar) return toast.warning('Excede o saldo do Pedido!');

        try {
            await insertFaturamentoSolicitacaoItem(selectedSolicitacao.id, {
                pedido: candidateItem.pedido,
                item: candidateItem.item,
                codigo_produto: candidateItem.codigo,
                quantidade_solicitada: parseFloat(addQtdForm),
                saldo_faturar_momentaneo: parseFloat(candidateItem.qtd_faturar),
                nota_fiscal: '',
                ped_cliente: candidateItem.ped_cliente,
                ref_cliente: candidateItem.ref_cliente,
                usuario: user?.nome || 'Sistema'
            });
            toast.success("Produto incluído à Solicitação!");
            setIsAddModalOpen(false);
            setCandidateItem(null);
            fetchSolicitacoes();
            loadAuditoria(selectedSolicitacao.id);
        } catch(err) {
            toast.error("Erro ao inserir produto na solicitação.");
        }
    };

    const toggleSelection = (id) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSendEmailLote = async () => {
        try {
            setLoadingEmail(true);
            await enviarFaturamentoEmailLote({
                ids: selectedItems,
                usuario: user?.nome || 'Sistema'
            });
            
            toast.success(`E-mail com ${selectedItems.length} faturamento(s) enviado com sucesso!`);
            setSelectedItems([]);
        } catch (err) {
            toast.error('Erro ao enviar e-mail em lote.');
        } finally {
            setLoadingEmail(false);
        }
    };

    const handleExportBatchExcel = () => {
        if (!selectedItems || selectedItems.length === 0) return;
        const lotes = solicitacoes.filter(s => selectedItems.includes(s.id));
        generateFaturamentosExcel(lotes);
        toast.success(`Planilha gerada com ${selectedItems.length} solicitações!`);
    };

    const handleSaveNf = async () => {
        if (isLockedFaturado) return toast.error("Apenas o usuário que mudou para 'Faturado' pode alterar a NF.");
        if (!selectedSolicitacao || !globalNf.trim()) return;
        setSavingNf(true);
        try {
            await updateFaturamentoSolicitacaoNotaFiscal(selectedSolicitacao.id, {
                nota_fiscal: globalNf.trim(),
                usuario: user?.nome || 'Sistema'
            });
            toast.success('Nota Fiscal salva com sucesso!');
            fetchSolicitacoes();
        } catch(e) {
            toast.error('Erro ao salvar Nota Fiscal.');
        } finally {
            setSavingNf(false);
        }
    };

    const handleChangeStatus = async (newStatus) => {
        if (isLockedFaturado) return toast.error("Apenas o usuário que mudou para 'Faturado' pode reverter ou alterar status.");
        if (!selectedSolicitacao) return;

        // NF obrigatória para marcar como Faturado
        if (newStatus === 'Atendido') {
            if (!globalNf.trim()) {
                toast.error('Informe o número da Nota Fiscal (campo "Nota Fiscal / Cabeçalho") antes de marcar como Faturado.');
                return;
            }
            const totalItens = selectedSolicitacao.itens?.length || 0;
            if (totalItens > 0 && itemChecks.length < totalItens) {
                toast.warning('Você precisa conferir (dar Check) em todos os itens antes de faturar.');
                return;
            }
        }

        if (!window.confirm(`Tem certeza que deseja mudar o status desta Solicitação para "${newStatus}"?`)) {
            return;
        }

        try {
            // Se tem NF pendente de salvar, salva junto
            if (newStatus === 'Atendido' && globalNf.trim() !== (selectedSolicitacao.nota_fiscal || '')) {
                await updateFaturamentoSolicitacaoNotaFiscal(selectedSolicitacao.id, {
                    nota_fiscal: globalNf.trim(),
                    usuario: user?.nome || 'Sistema'
                });
            }
            await updateFaturamentoSolicitacaoStatus(selectedSolicitacao.id, newStatus, user?.nome || 'Sistema');
            toast.success(`Status alterado para ${newStatus}!`);
            fetchSolicitacoes();
        } catch(e) { toast.error('Erro ao mudar status'); }
    };

    const handleDeleteItem = async (itemId) => {
        if (isLockedFaturado) return toast.error("Apenas o usuário que mudou para 'Faturado' pode excluir itens.");
        if (!window.confirm('Tem certeza que deseja remover este item desta Remessa?')) return;
        try {
            await deleteFaturamentoSolicitacaoItem(selectedSolicitacao.id, itemId, { usuario: user?.nome || 'Sistema' });
            toast.success('Item removido com sucesso!');
            fetchSolicitacoes();
        } catch(e) { toast.error('Erro ao remover item'); }
    }

    const toggleItemCheck = (itemId) => {
        setItemChecks(prev => prev.includes(itemId) ? prev.filter(i => i !== itemId) : [...prev, itemId]);
    }

    const [editingItemQty, setEditingItemQty] = useState({ id: null, value: '' });

    const handleSaveItemQty = async (item) => {
        if (isLockedFaturado) return toast.error("Apenas o usuário que mudou para 'Faturado' pode alterar as quantidades.");
        let valStr = String(editingItemQty.value).replace(',', '.');
        const novoValor = parseFloat(valStr);
        if (isNaN(novoValor) || novoValor <= 0) {
            toast.error("Quantidade inválida.");
            return;
        }
        
        try {
            await updateFaturamentoSolicitacaoItem(selectedSolicitacao.id, item.id, {
                quantidade_solicitada: novoValor,
                nota_fiscal: item.nota_fiscal || null,
                usuario: user?.nome || 'Sistema'
            });
            toast.success("Quantidade alterada com sucesso!");
            setEditingItemQty({ id: null, value: '' });
            fetchSolicitacoes();
        } catch (e) {
            toast.error(e?.response?.data?.error || "Erro ao alterar quantidade.");
        }
    };

    const fetchFinancialData = useCallback(async () => {
        if (!canViewFinancials) return;
        setFinLoading(true);
        try {
            const baseParams = {
                ...(finFilters.dataInicial && { dataInicial: finFilters.dataInicial }),
                ...(finFilters.dataFinal && { dataFinal: finFilters.dataFinal }),
                ...(finFilters.cliente && { cliente: finFilters.cliente }),
            };
            
            // Execute parallel requests for client grouping and period grouping
            const [clientRes, periodRes] = await Promise.all([
                getFaturamentoDashboard({ ...baseParams, groupBy: 'cliente' }),
                getFaturamentoDashboard({ ...baseParams, groupBy: finPeriodGroupBy }),
            ]);
            
            setClientData(clientRes);
            setPeriodData(periodRes);
        } catch (err) {
            toast.error('Erro ao carregar dados financeiros.');
            console.error(err);
        } finally {
            setFinLoading(false);
        }
    }, [finFilters, finPeriodGroupBy, canViewFinancials]);

    useEffect(() => {
        if (activeTab === 'financeiro') {
            fetchFinancialData();
        }
    }, [activeTab, fetchFinancialData]);

    const renderVisaoFinanceira = () => {
        if (!canViewFinancials) {
            return (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <Lock className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
                    <p className="text-sm text-gray-500 max-w-md">Você não possui a permissão <strong>valores_financeiros</strong> necessária para visualizar este painel financeiro.</p>
                </div>
            );
        }

        // Process KPIs (from clientData or periodData, they share the same status KPIs)
        let totalSolicitado = 0;
        let totalFaturado = 0;
        let totalPendente = 0;

        if (clientData?.kpis) {
            clientData.kpis.forEach(k => {
                // Sum requested value (all statuses except cancelled)
                if (k.status !== 'Cancelado') {
                    totalSolicitado += parseFloat(k.valor_total) || 0;
                }
                if (k.status === 'Atendido') {
                    totalFaturado += parseFloat(k.valor_total) || 0;
                }
                if (k.status === 'Pendente') {
                    totalPendente += parseFloat(k.valor_total) || 0;
                }
            });
        }

        const pctFaturado = totalSolicitado > 0 ? Math.round((totalFaturado / totalSolicitado) * 100) : 0;

        // Process charts
        const chartData = periodData?.agrupamento?.map(item => ({
            name: item.label,
            'Solicitado (R$)': parseFloat(item.valor_total) || 0,
            'Faturado (R$)': parseFloat(item.valor_faturado) || 0,
        })) || [];

        return (
            <div className="space-y-6 animate-fadeIn p-1">
                {/* Filtros rápidos e controles */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Period presets */}
                        {[
                            { label: '7d', days: 7 },
                            { label: '30d', days: 30 },
                            { label: '3m', months: 3 },
                            { label: '6m', months: 6 },
                            { label: '12m', months: 12 },
                        ].map(p => (
                            <button
                                key={p.label}
                                onClick={() => {
                                    setFinPeriodPreset(p.label);
                                    const today = new Date();
                                    const ini = p.months 
                                        ? format(subMonths(today, p.months), 'yyyy-MM-dd')
                                        : format(subDays(today, p.days), 'yyyy-MM-dd');
                                    setFinFilters(f => ({ ...f, dataInicial: ini, dataFinal: format(today, 'yyyy-MM-dd') }));
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
                                    finPeriodPreset === p.label 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                {p.label.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 md:max-w-2xl">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Início</label>
                            <input 
                                type="date" 
                                value={finFilters.dataInicial}
                                onChange={e => {
                                    setFinPeriodPreset('custom');
                                    setFinFilters(f => ({ ...f, dataInicial: e.target.value }));
                                }}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-300 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                            <input 
                                type="date" 
                                value={finFilters.dataFinal}
                                onChange={e => {
                                    setFinPeriodPreset('custom');
                                    setFinFilters(f => ({ ...f, dataFinal: e.target.value }));
                                }}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-300 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Buscar Cliente</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Nome do cliente..."
                                    value={finFilters.cliente}
                                    onChange={e => setFinFilters(f => ({ ...f, cliente: e.target.value }))}
                                    className="w-full text-xs border border-gray-200 rounded-lg p-2 pr-8 focus:ring-2 focus:ring-blue-300 outline-none"
                                />
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={fetchFinancialData}
                        disabled={finLoading}
                        className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 flex items-center gap-1.5 h-9"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${finLoading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Solicitado */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between min-h-[120px] relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Solicitado Total</span>
                            <DollarSign className="w-5 h-5 opacity-70" />
                        </div>
                        <div className="mt-2 z-10">
                            <h2 className="text-2xl font-black">{formatCurrency(totalSolicitado)}</h2>
                            <p className="text-[10px] opacity-75 mt-1">Soma de todas as solicitações comerciais no período</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
                    </div>

                    {/* Total Faturado / NFs */}
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between min-h-[120px] relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">NF Emitida (Faturado)</span>
                            <CheckCircle2 className="w-5 h-5 opacity-70" />
                        </div>
                        <div className="mt-2 z-10">
                            <h2 className="text-2xl font-black">{formatCurrency(totalFaturado)}</h2>
                            <p className="text-[10px] opacity-75 mt-1">Total de solicitações atendidas e faturadas</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
                    </div>

                    {/* Aguardando NF */}
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-sm flex flex-col justify-between min-h-[120px] relative overflow-hidden">
                        <div className="flex justify-between items-start z-10">
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">Aguardando Faturamento</span>
                            <Clock className="w-5 h-5 opacity-70" />
                        </div>
                        <div className="mt-2 z-10">
                            <h2 className="text-2xl font-black">{formatCurrency(totalPendente)}</h2>
                            <p className="text-[10px] opacity-75 mt-1">Solicitações pendentes aguardando faturamento</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
                    </div>

                    {/* Taxa de Atendimento */}
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[120px] relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Conversão de Faturamento</span>
                            <Target className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="mt-2">
                            <div className="flex items-baseline gap-1.5">
                                <h2 className="text-3xl font-black text-gray-800">{pctFaturado}%</h2>
                                <span className="text-xs text-gray-400 font-semibold">atendido</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                                <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${pctFaturado}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Evolução Periódica */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" /> Evolução por Período
                            </h3>
                            <p className="text-xs text-gray-400">Total solicitado vs notas fiscais emitidas agrupadas por data</p>
                        </div>
                        
                        <div className="flex bg-gray-100 rounded-lg p-1 self-start">
                            {[
                                { value: 'dia', label: 'Diário' },
                                { value: 'semana', label: 'Semanal' },
                                { value: 'mes', label: 'Mensal' },
                            ].map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setFinPeriodGroupBy(p.value)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                        finPeriodGroupBy === p.value 
                                            ? 'bg-white shadow text-blue-700' 
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        {finLoading ? (
                            <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Carregando dados do gráfico...</div>
                        ) : chartData.length === 0 ? (
                            <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Nenhuma movimentação registrada no período.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        tick={{ fontSize: 10, fill: '#64748b' }} 
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => {
                                            if (finPeriodGroupBy === 'mes') {
                                                try { return format(parseISO(`${v}-01`), 'MMM/yy', { locale: ptBR }); } catch { return v; }
                                            }
                                            if (finPeriodGroupBy === 'dia') {
                                                try { return format(parseISO(v), 'dd/MM', { locale: ptBR }); } catch { return v; }
                                            }
                                            if (finPeriodGroupBy === 'semana') {
                                                try { return format(parseISO(v), 'dd/MM', { locale: ptBR }); } catch { return v; }
                                            }
                                            return v;
                                        }}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 9, fill: '#64748b' }} 
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)}
                                    />
                                    <Tooltip 
                                        formatter={v => [formatCurrency(v), '']}
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                    <Bar dataKey="Solicitado (R$)" fill="#32423D" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Faturado (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Tabela de Clientes e Detalhes */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-600" /> Faturamento por Cliente
                            </h3>
                            <p className="text-xs text-gray-400">Total de solicitações e faturamento emitido por cada cliente no período</p>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3">Cliente</th>
                                    <th className="px-6 py-3 text-right">Qtd Solicitações</th>
                                    <th className="px-6 py-3 text-right">Itens</th>
                                    <th className="px-6 py-3 text-right">Solicitado Total</th>
                                    <th className="px-6 py-3 text-right">NF Emitida (Faturado)</th>
                                    <th className="px-6 py-3 text-right">Aguardando NF</th>
                                    <th className="px-6 py-3 text-center">% Faturado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {finLoading ? (
                                    [...Array(5)].map((_, idx) => (
                                        <tr key={idx} className="animate-pulse">
                                            <td className="px-6 py-4"><div className="h-3.5 bg-gray-100 rounded w-48" /></td>
                                            <td className="px-6 py-4 text-right"><div className="h-3.5 bg-gray-100 rounded w-12 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><div className="h-3.5 bg-gray-100 rounded w-12 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><div className="h-3.5 bg-gray-100 rounded w-24 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><div className="h-3.5 bg-gray-100 rounded w-24 ml-auto" /></td>
                                            <td className="px-6 py-4 text-right"><div className="h-3.5 bg-gray-100 rounded w-24 ml-auto" /></td>
                                            <td className="px-6 py-4"><div className="h-3.5 bg-gray-100 rounded w-20 mx-auto" /></td>
                                        </tr>
                                    ))
                                ) : !clientData?.agrupamento || clientData.agrupamento.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-10 text-center text-gray-400 italic">Nenhum dado financeiro de cliente encontrado no período.</td>
                                    </tr>
                                ) : (
                                    clientData.agrupamento.map((row, idx) => {
                                        const rowSolicitado = parseFloat(row.valor_total) || 0;
                                        const rowFaturado = parseFloat(row.valor_faturado) || 0;
                                        const rowPendente = Math.max(0, rowSolicitado - rowFaturado);
                                        const rowPct = rowSolicitado > 0 ? Math.round((rowFaturado / rowSolicitado) * 100) : 0;
                                        
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 font-semibold text-gray-800 truncate max-w-[280px]" title={row.label}>
                                                    {row.label || 'Não identificado'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-600 font-medium">
                                                    {row.qtd_solicitacoes}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-600 font-medium">
                                                    {row.qtd_itens}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-gray-700">
                                                    {formatCurrency(rowSolicitado)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-emerald-600 bg-emerald-50/20">
                                                    {formatCurrency(rowFaturado)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-amber-600">
                                                    {formatCurrency(rowPendente)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                                                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${rowPct}%` }} />
                                                        </div>
                                                        <span className="font-bold text-gray-700 w-10 text-right">{rowPct}%</span>
                                                    </div>
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
        );
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-[calc(100vh-64px)] flex flex-col gap-6 animate-fadeIn">
            {/* Header com Abas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-600" /> Faturamento Comercial
                    </h1>
                    <p className="text-xs text-gray-500">Gestão de solicitações de faturamento e análise de performance financeira.</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button 
                            onClick={() => setActiveTab('gestao')} 
                            className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'gestao' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Gestão de Solicitações
                        </button>
                        {canViewFinancials && (
                            <button 
                                onClick={() => setActiveTab('financeiro')} 
                                className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'financeiro' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Visão Financeira
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => openHelp('/comercial/faturamento')}
                        title="Ajuda e Manual do Controle de Faturamento"
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-slate-200 bg-white"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {activeTab === 'gestao' ? (
                <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
            {/* Esquerda: Lista de Solicitações */}
            <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col h-[calc(100vh-120px)]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Eye className="w-5 h-5 text-blue-600" /> Controle de Faturamento
                    </h2>
                </div>
                
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4 shrink-0">
                    <button onClick={() => setStatusFilter('Pendente')} className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'Pendente' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>Pendente</button>
                    <button onClick={() => setStatusFilter('Atendido')} className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'Atendido' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>Faturado</button>
                </div>

                {selectedItems.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex flex-col gap-2 shrink-0 animate-fadeIn">
                        <div className="text-sm text-blue-800 font-bold mb-1">
                            {selectedItems.length} {selectedItems.length === 1 ? 'solicitação selecionada' : 'solicitações selecionadas'}
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSendEmailLote} 
                                disabled={loadingEmail}
                                className="flex-1 text-xs font-bold px-3 py-2 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {loadingEmail ? 'Enviando...' : 'E-mail em Lote'}
                            </button>
                            <button 
                                onClick={handleExportBatchExcel} 
                                className="flex-1 flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 bg-green-600 text-white rounded shadow-sm hover:bg-green-700 transition"
                            >
                                <Download className="w-3 h-3" /> Extrair Lote
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto flex-1 scrollbar-thin pr-1 space-y-2">
                    {loading ? (
                        <div className="text-center p-4 text-gray-400">Carregando...</div>
                    ) : solicitacoes.length === 0 ? (
                        <div className="text-center p-4 text-gray-400 text-sm">Nenhuma solicitação encontrada.</div>
                    ) : (
                        solicitacoes.map(sol => (
                            <div 
                                key={sol.id} 
                                onClick={() => handleSelect(sol)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedSolicitacao?.id === sol.id ? 'border-blue-400 bg-blue-50/30 shadow-sm' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox"
                                            className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedItems.includes(sol.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleSelection(sol.id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="font-bold text-gray-900">{sol.numero_solicitacao}</span>
                                    </div>
                                    {sol.status === 'Pendente' ? 
                                        <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Aguardando NF</span>
                                        : 
                                        <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Faturado</span>
                                    }
                                </div>
                                <div className="text-xs text-gray-500 mb-1">
                                    <span className="font-semibold text-gray-700">Por:</span> {sol.usuario}
                                </div>
                                <div className="text-xs text-gray-400 flex justify-between">
                                    <span>{new Date(sol.created_at).toLocaleDateString('pt-BR')}</span>
                                    <span>{sol.qtd_itens_diferentes || 0} Itens</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Direita: Workspace / View */}
            <div className="w-full md:w-2/3 flex flex-col gap-6 h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin pr-1">
                {selectedSolicitacao ? (
                    <>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-black text-gray-800">{selectedSolicitacao.numero_solicitacao}</h2>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Solicitado por: <strong className="text-gray-700">{selectedSolicitacao.usuario}</strong> em <strong className="text-gray-700">{new Date(selectedSolicitacao.created_at).toLocaleString('pt-BR')}</strong>
                                    </p>
                                </div>
                                <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
                                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                                        <button onClick={() => handleChangeStatus('Pendente')} disabled={selectedSolicitacao.status === 'Pendente' || isLockedFaturado} className={`px-3 py-1.5 text-xs font-bold rounded-md ${selectedSolicitacao.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800 shadow' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}>Pendente</button>
                                        <button onClick={() => handleChangeStatus('Atendido')} disabled={selectedSolicitacao.status === 'Atendido' || isLockedFaturado} className={`px-3 py-1.5 text-xs font-bold rounded-md ${selectedSolicitacao.status === 'Atendido' ? 'bg-green-100 text-green-800 shadow' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}>Faturado</button>
                                        <button onClick={() => handleChangeStatus('Cancelado')} disabled={selectedSolicitacao.status === 'Cancelado' || isLockedFaturado} className={`px-3 py-1.5 text-xs font-bold rounded-md ${selectedSolicitacao.status === 'Cancelado' ? 'bg-red-100 text-red-800 shadow' : 'text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'}`}>Cancel</button>
                                    </div>
                                    <button 
                                        onClick={() => generateFaturamentosExcel([selectedSolicitacao])}
                                        className="text-sm font-bold px-3 py-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg transition-colors flex items-center gap-2 h-[34px]"
                                        title="Exportar Solicitação para Excel"
                                    >
                                        <Download className="w-4 h-4" /> Excel
                                    </button>
                                    <button 
                                        onClick={() => generateFaturamentoPdf(selectedSolicitacao, user)}
                                        className="text-sm font-bold px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2 h-[34px]"
                                        title="Exportar Solicitação para PDF"
                                    >
                                        <Download className="w-4 h-4" /> PDF
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className={`p-4 rounded-lg border-2 transition-colors ${!globalNf.trim() && selectedSolicitacao.status !== 'Cancelado' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                                    <label className="block text-xs font-bold uppercase mb-1 flex items-center gap-1.5">
                                        {!globalNf.trim() && selectedSolicitacao.status !== 'Cancelado'
                                            ? <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /><span className="text-amber-700">Nota Fiscal (Macro / Cabeçalho) — Obrigatório para Faturar</span></>
                                            : <span className="text-gray-500">Nota Fiscal (Macro / Cabeçalho)</span>
                                        }
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={globalNf}
                                            onChange={e => setGlobalNf(e.target.value)}
                                            placeholder="Ex: NF-00213"
                                            disabled={selectedSolicitacao.status === 'Cancelado' || isLockedFaturado}
                                            className={`flex-1 w-full text-sm rounded-md font-semibold focus:ring-2 focus:outline-none transition-colors ${
                                                !globalNf.trim() && selectedSolicitacao.status !== 'Cancelado'
                                                    ? 'border-amber-300 focus:ring-amber-300 bg-white text-gray-700'
                                                    : 'border-gray-300 focus:ring-blue-300 bg-white text-gray-700'
                                            } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                        />
                                        <button
                                            onClick={handleSaveNf}
                                            disabled={savingNf || !globalNf.trim() || selectedSolicitacao.status === 'Cancelado' || globalNf.trim() === (selectedSolicitacao.nota_fiscal || '') || isLockedFaturado}
                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                        >
                                            <Save className="w-3.5 h-3.5" /> {savingNf ? 'Salvando...' : 'Salvar NF'}
                                        </button>
                                    </div>
                                    {globalNf.trim() && globalNf.trim() !== (selectedSolicitacao.nota_fiscal || '') && (
                                        <p className="text-[10px] text-amber-600 font-medium mt-1">Alteração pendente — clique em "Salvar NF"</p>
                                    )}
                                </div>
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Observações da Expedição</label>
                                    <p className="text-sm text-yellow-900 whitespace-pre-wrap">{selectedSolicitacao.observacao || 'Nenhuma observação.'}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800 text-lg">Itens Faturados / Solicitados</h3>
                                {(selectedSolicitacao.status === 'Pendente' || (selectedSolicitacao.status === 'Atendido' && !isLockedFaturado)) && (
                                    <button 
                                        onClick={() => {
                                            setAddSearchText('');
                                            setAddSearchResults([]);
                                            setCandidateItem(null);
                                            setIsAddModalOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar Produto
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-lg rounded-t-none">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                                        <tr>
                                            <th className="px-3 py-3 font-semibold text-center w-8">OK</th>
                                            <th className="px-4 py-3 font-semibold">Ped-Item</th>
                                            <th className="px-4 py-3 font-semibold">Produto</th>
                                            <th className="px-2 py-3 font-semibold text-center">PDF</th>
                                            <th className="px-4 py-3 font-semibold bg-blue-50/50 text-blue-800">Cliente</th>
                                            <th className="px-4 py-3 font-semibold bg-blue-50/50 text-blue-800">Ped. Cli</th>
                                            <th className="px-4 py-3 font-semibold bg-blue-50/50 text-blue-800">Desenho Cli.</th>
                                            <th className="px-4 py-3 font-semibold bg-green-50/50 text-green-800">Nota Fiscal</th>
                                            <th className="px-4 py-3 font-semibold bg-green-50/50 text-green-800">Emissão NF</th>
                                            <th className="px-3 py-3 font-semibold text-center text-indigo-700 whitespace-nowrap">Dt. Entrega</th>
                                            <th className="px-3 py-3 font-semibold text-center text-indigo-700">Série Cli.</th>
                                            <th className="px-3 py-3 font-semibold text-center text-indigo-700">Série Lynx</th>
                                            <th className="px-3 py-3 font-semibold text-center text-indigo-700">Nº Série</th>
                                            <th className="px-3 py-3 font-semibold text-center text-indigo-700">Lote / Nº Lote</th>
                                            {canViewFinancials && <th className="px-4 py-3 font-semibold text-right">V. Unit (R$)</th>}
                                            {canViewFinancials && <th className="px-4 py-3 font-semibold text-right">V. Total (R$)</th>}
                                            <th className="px-4 py-3 font-semibold text-right">Qtd</th>
                                            <th className="px-2 py-3 font-semibold text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedSolicitacao.itens?.map(it => (
                                            <tr 
                                                key={it.id} 
                                                onClick={() => setSelectedRow(it.id)}
                                                className={`transition-colors cursor-pointer ${selectedRow === it.id ? 'bg-indigo-50/80 shadow-sm ring-1 ring-indigo-200' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-3 py-3 text-center">
                                                    <button onClick={() => toggleItemCheck(it.id)} className={`p-1 rounded-full transition-colors ${itemChecks.includes(it.id) ? 'bg-green-100 text-green-600 shadow-sm ring-1 ring-green-300' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'} focus:outline-none`} title="Verificar/Confirmar Item">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-gray-900 font-medium bg-gray-50/50">{it.pedido}-{it.item}</td>
                                                <td className="px-4 py-3 text-blue-700 font-semibold">{it.codigo_produto}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {pdfStatus[it.codigo_produto] ? (
                                                        <FileText 
                                                            onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(pdfStatus[it.codigo_produto])}`), '_blank'); }}
                                                            className="w-4 h-4 mx-auto text-red-500 cursor-pointer hover:text-red-700 transition" 
                                                            title="Visualizar Desenho PDF" 
                                                        />
                                                    ) : (
                                                        <FileText className="w-4 h-4 mx-auto text-gray-300" title="Arquivo PDF Ausente" />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-slate-800 font-bold bg-blue-50/30 whitespace-nowrap truncate max-w-[150px]" title={it.nome_cliente}>{it.nome_cliente || '-'}</td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-gray-600 bg-blue-50/30 whitespace-nowrap">{it.pedido_cliente || '-'}</td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-blue-900 font-bold bg-blue-50/30 whitespace-nowrap">{it.desenho_cliente || '-'}</td>
                                                <td className="px-4 py-3 bg-green-50/30">
                                                    {Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0 ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            {it.notas_fiscais_protheus.map((nf, nfIdx) => (
                                                                <span key={nfIdx} className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                                                    NF {nf.nota}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="font-mono text-[11px] text-gray-400">{it.nota_fiscal || selectedSolicitacao.nota_fiscal || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[11px] font-bold bg-green-50/30 whitespace-nowrap text-emerald-800">
                                                    {Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0
                                                        ? it.notas_fiscais_protheus[0].emissao || '-'
                                                        : '-'}
                                                </td>
                                                <td className="px-3 py-3 text-center text-xs font-bold text-indigo-700 whitespace-nowrap">
                                                    {it.pcp_data_entrega ? new Date(it.pcp_data_entrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-3 py-3 text-center text-xs text-indigo-600 font-medium">{it.pcp_serie_cliente || <span className="text-gray-300">—</span>}</td>
                                                <td className="px-3 py-3 text-center text-xs text-indigo-600 font-medium">{it.pcp_serie_lynx || it.pcp_serie_metalfisa || it.pcp_numero_serie || <span className="text-gray-300">—</span>}</td>
                                                <td className="px-3 py-3 text-center text-xs text-indigo-600 font-medium">{it.pcp_numero_serie || <span className="text-gray-300">—</span>}</td>
                                                <td className="px-3 py-3 text-center">
                                                    {(it.pcp_lote || it.pcp_numero_lote) ? (
                                                        <div className="text-xs text-indigo-600">
                                                            {it.pcp_lote && <div className="font-medium">{it.pcp_lote}</div>}
                                                            {it.pcp_numero_lote && <div className="text-[10px] text-gray-500">{it.pcp_numero_lote}</div>}
                                                        </div>
                                                    ) : <span className="text-gray-300 text-[10px]">—</span>}
                                                </td>

                                                {canViewFinancials && <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(it.valor_unitario)}</td>}
                                                {canViewFinancials && <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{formatCurrency(it.valor_total)}</td>}

                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        {(selectedSolicitacao.status === 'Pendente' || (selectedSolicitacao.status === 'Atendido' && !isLockedFaturado)) && editingItemQty.id === it.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    value={editingItemQty.value}
                                                                    onChange={(e) => setEditingItemQty({ ...editingItemQty, value: e.target.value })}
                                                                    className="w-16 px-1 py-1 text-right text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveItemQty(it);
                                                                        if (e.key === 'Escape') setEditingItemQty({ id: null, value: '' });
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => handleSaveItemQty(it)}
                                                                    className="text-white bg-blue-600 hover:bg-blue-700 p-1 rounded"
                                                                    title="Salvar Qtd"
                                                                >
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingItemQty({ id: null, value: '' })}
                                                                    className="text-gray-500 hover:bg-gray-100 p-1 rounded"
                                                                    title="Cancelar"
                                                                >
                                                                    <XCircle className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className={`font-black text-gray-800 ${(selectedSolicitacao.status === 'Pendente' || (selectedSolicitacao.status === 'Atendido' && !isLockedFaturado)) ? 'cursor-pointer hover:underline decoration-blue-400 underline-offset-2 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors' : 'px-2 py-0.5'}`}
                                                                title={(selectedSolicitacao.status === 'Pendente' || (selectedSolicitacao.status === 'Atendido' && !isLockedFaturado)) ? "Clique para editar quantidade" : ""}
                                                                onClick={() => {
                                                                    if (selectedSolicitacao.status === 'Pendente' || (selectedSolicitacao.status === 'Atendido' && !isLockedFaturado)) {
                                                                        setEditingItemQty({ id: it.id, value: String(it.quantidade_solicitada).replace('.', ',') });
                                                                    }
                                                                }}
                                                            >
                                                                {parseFloat(it.quantidade_solicitada).toLocaleString('pt-BR')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    {(!isLockedFaturado) && (
                                                        <button onClick={() => handleDeleteItem(it.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors mx-auto" title="Remover Item Falho">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!selectedSolicitacao.itens || selectedSolicitacao.itens.length === 0) && (
                                            <tr>
                                                <td colSpan="6" className="text-center p-6 text-gray-500 text-sm">Nenhum item adicionado à solicitação.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Aba Auditoria */}
                        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-5 overflow-hidden">
                            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 mb-4">
                                <History className="w-5 h-5 text-blue-400" /> Diário de Auditoria (Rastreabilidade)
                            </h3>
                            <div className="relative border-l-2 border-slate-700 ml-3 pl-4 pb-4 space-y-6">
                                {auditoria.map(log => {
                                    let dt = null;
                                    try { dt = JSON.parse(log.detalhes) } catch(e){}
                                    return (
                                        <div key={log.id} className="relative">
                                            <div className="absolute -left-[23px] top-1 w-3 h-3 bg-blue-500 rounded-full ring-4 ring-slate-900"></div>
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-blue-400 font-bold text-sm">{log.usuario}</span>
                                                    <span className="text-slate-500 text-[10px]">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="text-slate-300 text-xs">
                                                    {TranslateAcao(log.acao, dt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {auditoria.length === 0 && <div className="text-slate-500 text-xs italic">Nenhum evento registrado.</div>}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100 border-dashed">
                        <FileText className="w-16 h-16 mb-4 opacity-20" />
                        <p>Selecione uma solicitação no painel esquerdo para visualizar.</p>
                    </div>
                )}
            </div>
            </div>
            ) : (
                <div className="flex-1 overflow-y-auto h-[calc(100vh-200px)] scrollbar-thin pr-1">
                    {renderVisaoFinanceira()}
                </div>
            )}

            {/* FLOATING ACTION BAR PARA ENVIO DE E-MAIL LOTE */}
            {selectedItems.length > 0 && (
                <div className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 z-50 animate-fadeIn">
                    <div>
                        <span className="font-bold text-lg">{selectedItems.length}</span> selecionados
                    </div>
                    <button 
                        onClick={handleSendEmailLote}
                        disabled={loadingEmail}
                        className="bg-white text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                        {loadingEmail ? 'Enviando...' : 'Enviar por E-mail'}
                    </button>
                    <button onClick={() => setSelectedItems([])} className="text-blue-200 hover:text-white transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* ADD ITEM MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Adicionar Produto à Solicitação</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="p-4 bg-white border-b border-gray-100 flex gap-2">
                            <input 
                                type="text"
                                placeholder="Busque por Pedido, Cód. Cliente ou Produto..."
                                className="flex-1 border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                                value={addSearchText}
                                onChange={e => setAddSearchText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchAdd()}
                            />
                            <button 
                                onClick={handleSearchAdd}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Search className="w-4 h-4" /> Procurar
                            </button>
                        </div>

                        <div className="h-64 overflow-y-auto bg-gray-50/50 p-2">
                            {isAddSearching ? <div className="text-center p-6 text-gray-500 text-sm">Buscando no Protheus...</div> : null}
                            {!isAddSearching && addSearchResults.length === 0 ? <div className="text-center p-6 text-gray-400 text-sm">Use a busca acima.</div> : null}
                            {!isAddSearching && addSearchResults.map((rst, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => setCandidateItem(candidateItem === rst ? null : rst)}
                                    className={`p-3 bg-white border rounded-lg mb-2 cursor-pointer transition-colors flex justify-between items-center ${candidateItem === rst ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div>
                                        <div className="font-mono text-sm font-bold text-gray-800">{rst.pedido}-{rst.item} <span className="ml-2 text-blue-700">{rst.codigo}</span></div>
                                        <div className="text-xs text-gray-500 mt-1">{rst.nome_cliente || rst.ref_cliente}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Saldo a Faturar</div>
                                        <div className="font-black text-gray-900 text-lg">{parseFloat(rst.qtd_faturar).toLocaleString('pt-BR')} <span className="text-xs font-normal text-gray-500">{rst.unidade}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {candidateItem && (
                            <div className="p-4 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-blue-900 mb-1">Confirmar Quantidade (Máx: {parseFloat(candidateItem.qtd_faturar)})</p>
                                    <input 
                                        type="number"
                                        className="w-32 border-blue-300 rounded text-sm focus:ring-blue-500"
                                        value={addQtdForm}
                                        onChange={e => setAddQtdForm(e.target.value)}
                                        placeholder="Qtd Faturar"
                                    />
                                </div>
                                <button 
                                    onClick={handleConfirmAddItem}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm"
                                >
                                    Adicionar à Fatura
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControleFaturamento;
