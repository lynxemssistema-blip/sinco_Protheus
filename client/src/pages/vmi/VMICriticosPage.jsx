import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    AlertOctagon, UploadCloud, FileSpreadsheet, Search, Filter, Download, 
    ChevronDown, ChevronRight, ChevronUp, CheckCircle2, XCircle, Clock, 
    Layers, Package, AlertCircle, RefreshCw, FileText, Calendar, 
    TrendingDown, TrendingUp, BarChart2, ArrowRight, Trash2, Printer, 
    Eye, Check, Copy, Split, History, Sparkles, CheckSquare, ShieldAlert,
    HelpCircle
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, LineChart, Line, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useHelp } from '../../contexts/HelpContext';
import { generateEspelhoNfPdf } from '../../services/espelhoNfPdfGenerator';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

export default function VMICriticosPage() {
    const { user, hasPermission } = useAuth();
    const { openHelp } = useHelp();
    const canViewValues = hasPermission('valores_financeiros', 'view');

    // Abas de navegação da página
    const [activeTab, setActiveTab] = useState('espelho'); // 'espelho' | 'importar' | 'comparador' | 'evolucao' | 'versoes'

    // Estado da versão ativa / dados carregados
    const [activeVersaoId, setActiveVersaoId] = useState(null);
    const [activeVersaoInfo, setActiveVersaoInfo] = useState(null);
    const [activeItens, setActiveItens] = useState([]);
    const [loading, setLoading] = useState(false);
    const [versoesList, setVersoesList] = useState([]);

    // Filtros do Espelho
    const [filterText, setFilterText] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'FALTA_ENTREGA' | 'MATERIAL_OK' | 'COM_PEDIDO' | 'COM_NF'
    const [expandedItemKeys, setExpandedItemKeys] = useState({});

    // Estado do Upload / Seletor de Abas
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadSheetPreview, setUploadSheetPreview] = useState(null); // { fileName, totalSheets, sheets: [] }
    const [selectedSheet, setSelectedSheet] = useState('');
    const [customVersionTitle, setCustomVersionTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Estado do Comparador
    const [compareVersaoAId, setCompareVersaoAId] = useState('');
    const [compareVersaoBId, setCompareVersaoBId] = useState('');
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareResult, setCompareResult] = useState(null);
    const [compareFilterStatus, setCompareFilterStatus] = useState('ALL'); // 'ALL' | 'RESOLVIDOS' | 'NOVOS' | 'ALTERADOS'

    // Estado da Curva de Evolução
    const [evolucaoData, setEvolucaoData] = useState([]);
    const [evolucaoLoading, setEvolucaoLoading] = useState(false);

    // Carregar lista de versões salvas
    const carregarVersoes = async (autoSelectLatest = false) => {
        try {
            const res = await api.get('/vmi-criticos/versoes');
            setVersoesList(res.data || []);
            if (autoSelectLatest && res.data && res.data.length > 0) {
                carregarDetalhesVersao(res.data[0].id);
            }
        } catch (err) {
            console.error('Erro ao carregar lista de versões:', err);
        }
    };

    // Carregar dados de uma versão específica
    const carregarDetalhesVersao = async (versaoId) => {
        try {
            setLoading(true);
            const res = await api.get(`/vmi-criticos/versoes/${versaoId}`);
            setActiveVersaoId(versaoId);
            setActiveVersaoInfo(res.data.versao);
            setActiveItens(res.data.itens || []);
            setActiveTab('espelho');
        } catch (err) {
            console.error('Erro ao carregar detalhes da versão:', err);
            toast.error('Erro ao carregar versão: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Carregar curva de evolução
    const carregarEvolucao = async () => {
        try {
            setEvolucaoLoading(true);
            const res = await api.get('/vmi-criticos/evolucao');
            setEvolucaoData(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar curva de evolução:', err);
        } finally {
            setEvolucaoLoading(false);
        }
    };

    useEffect(() => {
        carregarVersoes(true);
        carregarEvolucao();
    }, []);

    // ── UPLOAD: Ler abas do Excel ──
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadFile(file);
        setUploading(true);

        const formData = new FormData();
        formData.append('planilha', file);

        try {
            const res = await api.post('/vmi-criticos/preview-abas', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadSheetPreview(res.data);

            // Selecionar automaticamente a aba sugerida
            const suggested = res.data.sheets.find(s => s.isSuggested);
            if (suggested) {
                setSelectedSheet(suggested.name);
            } else if (res.data.sheets.length > 0) {
                setSelectedSheet(res.data.sheets[0].name);
            }

            const dataStr = new Date().toLocaleDateString('pt-BR');
            setCustomVersionTitle(`Posição Críticos ${dataStr} (${file.name})`);
            toast.info(`Arquivo carregado! Selecione a aba desejada.`);
        } catch (err) {
            console.error('Erro na prévia das abas:', err);
            toast.error('Erro ao ler abas da planilha: ' + (err.response?.data?.error || err.message));
            setUploadFile(null);
            setUploadSheetPreview(null);
        } finally {
            setUploading(false);
        }
    };

    // ── PROCESSAR E SALVAR VERSÃO ──
    const handleProcessarESalvar = async () => {
        if (!uploadFile || !selectedSheet) {
            toast.warning('Selecione um arquivo e a aba desejada.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('planilha', uploadFile);
        formData.append('sheetName', selectedSheet);
        formData.append('tituloVersao', customVersionTitle);
        formData.append('salvarVersao', 'true');
        formData.append('usuarioId', user?.id || '');
        formData.append('usuarioNome', user?.nome || '');

        try {
            const res = await api.post('/vmi-criticos/processar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success(`Versão "${res.data.tituloVersao}" processada e salva com sucesso! (${res.data.totalItens} itens)`);
            
            // Limpar estado do upload
            setUploadFile(null);
            setUploadSheetPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Recarregar listas e selecionar a nova versão
            await carregarVersoes();
            await carregarEvolucao();
            if (res.data.versaoId) {
                await carregarDetalhesVersao(res.data.versaoId);
            }
        } catch (err) {
            console.error('Erro ao processar e salvar versão:', err);
            toast.error('Erro ao processar: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    // ── EXCLUIR VERSÃO ──
    const handleExcluirVersao = async (id, titulo) => {
        if (!window.confirm(`Tem certeza que deseja excluir a versão "${titulo || id}"?`)) return;

        try {
            await api.delete(`/vmi-criticos/versoes/${id}`);
            toast.success('Versão excluída com sucesso!');
            await carregarVersoes();
            await carregarEvolucao();
            if (activeVersaoId === id) {
                setActiveVersaoId(null);
                setActiveVersaoInfo(null);
                setActiveItens([]);
            }
        } catch (err) {
            toast.error('Erro ao excluir versão: ' + err.message);
        }
    };

    // ── COMPARAR 2 VERSÕES ──
    const handleExecutarComparacao = async () => {
        if (!compareVersaoAId || !compareVersaoBId) {
            toast.warning('Selecione a Versão A e a Versão B para comparação.');
            return;
        }

        if (compareVersaoAId === compareVersaoBId) {
            toast.warning('Selecione duas versões diferentes para comparar.');
            return;
        }

        setCompareLoading(true);
        try {
            const res = await api.post('/vmi-criticos/comparar', {
                versaoAId: compareVersaoAId,
                versaoBId: compareVersaoBId
            });
            setCompareResult(res.data);
            toast.success('Comparação realizada com sucesso!');
        } catch (err) {
            console.error('Erro ao comparar:', err);
            toast.error('Erro na comparação: ' + (err.response?.data?.error || err.message));
        } finally {
            setCompareLoading(false);
        }
    };

    // Alternar expansão de item
    const toggleExpandItem = (key) => {
        setExpandedItemKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Exportar Tabela Ativa para Excel
    const handleExportExcel = () => {
        if (activeItens.length === 0) return;
        const rows = activeItens.map(it => ({
            'Código VMI': it.codVmi,
            'Código MetalFisa': it.b1Cod || it.codMetalfisa,
            'Descrição': it.descricao,
            'Prioridade': it.prioridade || '-',
            'WK 01': it.wk01,
            'WK 02': it.wk02,
            'WK 03': it.wk03,
            'WK 04': it.wk04,
            'WK 05': it.wk05,
            'Total Faltantes (Planilha)': it.totalFaltantes,
            'Entradas': it.entradas,
            'Pré-Nota': it.preNota,
            'Status Entrega': it.statusEntrega,
            'Follow-up': it.followUp || '-',
            'Previsão Entrega': it.previsaoEntrega || '-',
            'Saldo Pedidos MetalFisa': it.saldoPedidosMetalFisa,
            'Faturado MetalFisa': it.faturadoMetalFisa,
            'Qtd Pedidos Vinculados': it.pedidos?.length || 0,
            'Qtd NFs Emitidas': it.nfs?.length || 0
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tabela de Críticos');
        XLSX.writeFile(wb, `Tabela_Criticos_VMI_${activeVersaoInfo?.dataReferencia?.replace(/\//g, '-') || 'Export'}.xlsx`);
    };

    // Itens filtrados do espelho
    const filteredItens = useMemo(() => {
        return activeItens.filter(it => {
            if (filterStatus === 'FALTA_ENTREGA' && it.statusEntrega !== 'FALTA ENTREGA') return false;
            if (filterStatus === 'MATERIAL_OK' && it.statusEntrega !== 'MATERIAL OK') return false;
            if (filterStatus === 'COM_PEDIDO' && (!it.pedidos || it.pedidos.length === 0)) return false;
            if (filterStatus === 'COM_NF' && (!it.nfs || it.nfs.length === 0)) return false;

            if (filterText) {
                const search = filterText.toLowerCase();
                const vmi = String(it.codVmi || '').toLowerCase();
                const metal = String(it.b1Cod || it.codMetalfisa || '').toLowerCase();
                const desc = String(it.descricao || '').toLowerCase();
                const follow = String(it.followUp || '').toLowerCase();
                return vmi.includes(search) || metal.includes(search) || desc.includes(search) || follow.includes(search);
            }

            return true;
        });
    }, [activeItens, filterText, filterStatus]);

    // Resumo de contadores da versão ativa
    const resumoAtivo = useMemo(() => {
        const total = activeItens.length;
        const faltantes = activeItens.reduce((acc, it) => acc + Math.abs(Number(it.totalFaltantes) || 0), 0);
        const okCount = activeItens.filter(it => it.statusEntrega === 'MATERIAL OK').length;
        const pendenteCount = activeItens.filter(it => it.statusEntrega !== 'MATERIAL OK').length;
        const comPedidoCount = activeItens.filter(it => it.pedidos && it.pedidos.length > 0).length;
        const comNfCount = activeItens.filter(it => it.nfs && it.nfs.length > 0).length;
        const saldoMetal = activeItens.reduce((acc, it) => acc + (Number(it.saldoPedidosMetalFisa) || 0), 0);
        const fatMetal = activeItens.reduce((acc, it) => acc + (Number(it.faturadoMetalFisa) || 0), 0);

        return {
            total,
            faltantes,
            okCount,
            pendenteCount,
            comPedidoCount,
            comNfCount,
            saldoMetal,
            fatMetal,
            taxaAtendimento: total > 0 ? ((okCount / total) * 100).toFixed(1) : 0
        };
    }, [activeItens]);

    // Itens filtrados no comparador
    const filteredCompareItens = useMemo(() => {
        if (!compareResult?.itens) return [];
        return compareResult.itens.filter(it => {
            if (compareFilterStatus === 'RESOLVIDOS' && it.classificacao !== 'RESOLVIDO_MATERIAL_OK' && it.classificacao !== 'REMOVIDO_DA_PLANILHA') return false;
            if (compareFilterStatus === 'NOVOS' && it.classificacao !== 'NOVO_CRITICO' && it.classificacao !== 'NOVO_NOVO_ITEM') return false;
            if (compareFilterStatus === 'ALTERADOS' && it.classificacao !== 'SALDO_REDUZIDO' && it.classificacao !== 'SALDO_AUMENTADO') return false;
            return true;
        });
    }, [compareResult, compareFilterStatus]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 space-y-6">
            
            {/* ── HEADER PRINCIPAL ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-2xs">
                        <AlertOctagon className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Tabela de Críticos (VMI)</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Multi-Versões & Inteligência Protheus
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Espelho de faltantes, cruzamento automático com pedidos e notas fiscais MetalFisa, comparador de versões e curva de evolução.
                        </p>
                    </div>
                </div>

                {/* Seletor Rápido de Versão Ativa */}
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    {versoesList.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200">
                            <History className="w-4 h-4 text-slate-500 ml-1.5" />
                            <select
                                value={activeVersaoId || ''}
                                onChange={(e) => carregarDetalhesVersao(Number(e.target.value))}
                                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden pr-3 cursor-pointer"
                            >
                                {versoesList.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.titulo_versao || `Versão ${v.id}`} ({v.data_referencia || 'N/A'}) — {v.total_itens} itens
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={() => setActiveTab('importar')}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap active:scale-95"
                    >
                        <UploadCloud className="w-4 h-4" />
                        <span>Nova Planilha</span>
                    </button>

                    <button
                        onClick={() => openHelp('/vmi/criticos')}
                        title="Ajuda e Manual desta Tela"
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-white"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── NAVEGAÇÃO ENTRE ABAS ── */}
            <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 text-sm font-bold">
                <button
                    onClick={() => setActiveTab('espelho')}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'espelho'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Espelho da Planilha</span>
                    {activeItens.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'espelho' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {activeItens.length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('comparador')}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'comparador'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                >
                    <Split className="w-4 h-4" />
                    <span>Comparador de Versões</span>
                </button>

                <button
                    onClick={() => setActiveTab('evolucao')}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'evolucao'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                >
                    <TrendingDown className="w-4 h-4" />
                    <span>Curva de Evolução</span>
                </button>

                <button
                    onClick={() => setActiveTab('importar')}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'importar'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                >
                    <UploadCloud className="w-4 h-4" />
                    <span>Importar Planilha</span>
                </button>

                <button
                    onClick={() => setActiveTab('versoes')}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'versoes'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                >
                    <History className="w-4 h-4" />
                    <span>Histórico de Snapshots</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'versoes' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {versoesList.length}
                    </span>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* ABA 1: ESPELHO DA PLANILHA ATIVA                                          */}
            {/* ========================================================================= */}
            {activeTab === 'espelho' && (
                <div className="space-y-5">
                    {/* CARDS KPI DE RESUMO */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Itens</span>
                            <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black text-slate-800">{resumoAtivo.total}</span>
                                <Package className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
                            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Material OK</span>
                            <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black text-emerald-700">{resumoAtivo.okCount}</span>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                                    {resumoAtivo.taxaAtendimento}%
                                </span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-2xs">
                            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Falta Entrega</span>
                            <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black text-rose-700">{resumoAtivo.pendenteCount}</span>
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-2xs">
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Saldo Pedidos Metal</span>
                            <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black text-blue-700">{resumoAtivo.saldoMetal.toLocaleString('pt-BR')}</span>
                                <span className="text-xs text-slate-400">peças</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-2xs">
                            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Faturado MetalFisa</span>
                            <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black text-indigo-700">{resumoAtivo.fatMetal.toLocaleString('pt-BR')}</span>
                                <span className="text-xs text-slate-400">peças</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs">
                            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Com NFs Emitidas</span>
                            <div className="flex items-baseline justify-between mt-1">
                                <span className="text-2xl font-black text-amber-700">{resumoAtivo.comNfCount}</span>
                                <span className="text-xs text-slate-400">itens</span>
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS & AÇÕES */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="flex flex-1 items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código VMI, código MetalFisa, descrição ou follow-up..."
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                            >
                                <option value="ALL">Todos os Status ({activeItens.length})</option>
                                <option value="FALTA_ENTREGA">⚠️ Falta Entrega ({resumoAtivo.pendenteCount})</option>
                                <option value="MATERIAL_OK">✅ Material OK ({resumoAtivo.okCount})</option>
                                <option value="COM_PEDIDO">📦 Com Pedido MetalFisa ({resumoAtivo.comPedidoCount})</option>
                                <option value="COM_NF">📑 Com NF Emitida ({resumoAtivo.comNfCount})</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportExcel}
                                disabled={activeItens.length === 0}
                                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                            >
                                <Download className="w-4 h-4 text-emerald-600" />
                                <span>Exportar Excel</span>
                            </button>
                        </div>
                    </div>

                    {/* TABELA DO ESPELHO DE CRÍTICOS */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-slate-500 space-y-3">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                                <p className="text-sm font-semibold">Carregando espelho da versão...</p>
                            </div>
                        ) : filteredItens.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 space-y-3">
                                <Package className="w-12 h-12 mx-auto text-slate-300" />
                                <p className="text-base font-bold text-slate-600">Nenhum registro encontrado</p>
                                <p className="text-xs">Faça o upload de uma nova planilha ou selecione outra versão no topo.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                                        <tr>
                                            <th className="w-10 px-3 py-3 text-center"></th>
                                            <th className="px-3 py-3">Cód. VMI (Col C)</th>
                                            <th className="px-3 py-3">Cód. MetalFisa (Col B)</th>
                                            <th className="px-4 py-3 min-w-[220px]">Descrição do Produto</th>
                                            <th className="px-2.5 py-3 text-right">WK 01</th>
                                            <th className="px-2.5 py-3 text-right">WK 02</th>
                                            <th className="px-2.5 py-3 text-right">WK 03</th>
                                            <th className="px-2.5 py-3 text-right">WK 04</th>
                                            <th className="px-2.5 py-3 text-right">WK 05</th>
                                            <th className="px-3 py-3 text-right font-black text-slate-900 bg-slate-200/50">Faltantes</th>
                                            <th className="px-3 py-3 text-center">Status Planilha</th>
                                            <th className="px-3 py-3 text-right text-blue-700 bg-blue-50/50">Saldo Ped. Metal</th>
                                            <th className="px-3 py-3 text-right text-emerald-700 bg-emerald-50/50">Faturado Metal</th>
                                            <th className="px-3 py-3 text-center">Follow-up / Previsão</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredItens.map((it, idx) => {
                                            const itemKey = `${it.codVmi}_${it.codMetalfisa}_${idx}`;
                                            const isExpanded = !!expandedItemKeys[itemKey];
                                            const isOk = it.statusEntrega === 'MATERIAL OK';

                                            return (
                                                <React.Fragment key={itemKey}>
                                                    <tr 
                                                        onClick={() => toggleExpandItem(itemKey)}
                                                        className={`cursor-pointer transition-colors ${
                                                            isExpanded ? 'bg-blue-50/40 font-medium' : 'hover:bg-slate-50/90'
                                                        }`}
                                                    >
                                                        <td className="px-3 py-3 text-center text-slate-400">
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-4 h-4 inline text-blue-600" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 inline text-slate-400" />
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 font-mono font-bold text-slate-900">
                                                            {it.codVmi}
                                                        </td>
                                                        <td className="px-3 py-3 font-mono font-bold text-blue-700">
                                                            {it.b1Cod || it.codMetalfisa || (
                                                                <span className="text-slate-400 font-normal italic text-[11px]">Não mapeado</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 max-w-[300px]">
                                                            <p className="font-semibold text-slate-800 truncate" title={it.descricao}>
                                                                {it.descricao || '-'}
                                                            </p>
                                                            {it.prioridade && (
                                                                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                                                    Prioridade {it.prioridade}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-2.5 py-3 text-right font-mono text-slate-600">{it.wk01 || '-'}</td>
                                                        <td className="px-2.5 py-3 text-right font-mono text-slate-600">{it.wk02 || '-'}</td>
                                                        <td className="px-2.5 py-3 text-right font-mono text-slate-600">{it.wk03 || '-'}</td>
                                                        <td className="px-2.5 py-3 text-right font-mono text-slate-600">{it.wk04 || '-'}</td>
                                                        <td className="px-2.5 py-3 text-right font-mono text-slate-600">{it.wk05 || '-'}</td>
                                                        
                                                        <td className="px-3 py-3 text-right font-mono font-black text-[13px] bg-slate-50 text-slate-900">
                                                            {it.totalFaltantes}
                                                        </td>

                                                        <td className="px-3 py-3 text-center">
                                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 border ${
                                                                isOk 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                            }`}>
                                                                {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                                {it.statusEntrega}
                                                            </span>
                                                        </td>

                                                        <td className="px-3 py-3 text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                                                            {it.saldoPedidosMetalFisa > 0 ? it.saldoPedidosMetalFisa.toLocaleString('pt-BR') : '-'}
                                                        </td>

                                                        <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                                                            {it.faturadoMetalFisa > 0 ? it.faturadoMetalFisa.toLocaleString('pt-BR') : '-'}
                                                        </td>

                                                        <td className="px-3 py-3 max-w-[200px]">
                                                            {it.followUp ? (
                                                                <p className="text-[11px] text-slate-700 truncate font-medium" title={it.followUp}>
                                                                    {it.followUp}
                                                                </p>
                                                            ) : it.previsaoEntrega ? (
                                                                <span className="text-[11px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                                                    Prev: {it.previsaoEntrega}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">-</span>
                                                            )}
                                                        </td>
                                                    </tr>

                                                    {/* ── PAINEL EXPANSÍVEL: DETALHES DE PEDIDOS, OPS E NOTAS FISCAIS ── */}
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={14} className="p-0 bg-slate-50/80">
                                                                <div className="p-4 pl-12 pr-6 border-y border-blue-100 bg-gradient-to-r from-blue-50/30 to-slate-50 space-y-4">
                                                                    
                                                                    {/* 1. PEDIDOS DE VENDA METALFISA */}
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                                                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                                                                Pedidos de Venda MetalFisa (SC6010 / SC5010) — {it.pedidos?.length || 0} encontrado(s)
                                                                            </span>
                                                                        </div>

                                                                        {it.pedidos && it.pedidos.length > 0 ? (
                                                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                                                                <table className="w-full text-left text-xs whitespace-nowrap">
                                                                                    <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                                                                                        <tr>
                                                                                            <th className="px-3 py-2">Pedido / Item PV</th>
                                                                                            <th className="px-3 py-2">Pedido Cliente</th>
                                                                                            <th className="px-3 py-2">Código Protheus</th>
                                                                                            <th className="px-3 py-2 text-right">Qtd Pedida</th>
                                                                                            <th className="px-3 py-2 text-right">Faturado</th>
                                                                                            <th className="px-3 py-2 text-right text-blue-700">Saldo a Faturar</th>
                                                                                            <th className="px-3 py-2 text-center">Entrega Protheus</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100">
                                                                                        {it.pedidos.map((p, pIdx) => (
                                                                                            <tr key={pIdx} className="hover:bg-slate-50">
                                                                                                <td className="px-3 py-2 font-mono font-bold text-blue-700">
                                                                                                    {p.pedido_metal}-{p.item_pedido}
                                                                                                </td>
                                                                                                <td className="px-3 py-2 text-slate-700">{p.pedido_cliente || '-'}</td>
                                                                                                <td className="px-3 py-2 font-mono">{p.cod_produto}</td>
                                                                                                <td className="px-3 py-2 text-right font-mono">{parseFloat(p.qtd_pedida || 0).toLocaleString('pt-BR')}</td>
                                                                                                <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold">{parseFloat(p.qtd_faturada || 0).toLocaleString('pt-BR')}</td>
                                                                                                <td className="px-3 py-2 text-right font-mono text-blue-700 font-black">{parseFloat(p.saldo_a_faturar || 0).toLocaleString('pt-BR')}</td>
                                                                                                <td className="px-3 py-2 text-center font-mono text-slate-600">{p.data_entrega_formatada || '-'}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-xs text-slate-400 italic bg-white p-2.5 rounded-lg border border-slate-200">
                                                                                Nenhum pedido de venda em aberto ou faturado localizado no Protheus para esta referência.
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {/* 2. NOTAS FISCAIS FATURADAS (SD2010) */}
                                                                    {it.nfs && it.nfs.length > 0 && (
                                                                        <div className="space-y-2">
                                                                            <span className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                                                                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                                                                Notas Fiscais Emitidas para este Item ({it.nfs.length} NFs)
                                                                            </span>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                                {it.nfs.map((nf, nfIdx) => (
                                                                                    <div key={nfIdx} className="bg-white p-2.5 rounded-lg border border-emerald-200/80 flex items-center justify-between shadow-2xs">
                                                                                        <div>
                                                                                            <span className="font-mono font-bold text-xs text-emerald-800">NF {nf.nota} S.{nf.serie}</span>
                                                                                            <p className="text-[11px] text-slate-500 font-mono">Emissão: {nf.emissao} • Qtd: <strong>{nf.qtd_faturada} un</strong></p>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => generateEspelhoNfPdf({
                                                                                                doc: nf.nota,
                                                                                                serie: nf.serie,
                                                                                                emissao: nf.emissao,
                                                                                                cliente_nome: 'VMI SISTEMAS DE SEGURANCA LTDA',
                                                                                                itens: [{
                                                                                                    item: '01',
                                                                                                    pedido: nf.pedido,
                                                                                                    itempv: nf.item,
                                                                                                    codigo: nf.cod_produto,
                                                                                                    descricao: it.descricao,
                                                                                                    quantidade: nf.qtd_faturada
                                                                                                }]
                                                                                            }, canViewValues, user)}
                                                                                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors"
                                                                                            title="Imprimir Espelho da NF"
                                                                                        >
                                                                                            <Printer className="w-3 h-3" />
                                                                                            <span>PDF</span>
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA 2: COMPARADOR DE VERSÕES                                              */}
            {/* ========================================================================= */}
            {activeTab === 'comparador' && (
                <div className="space-y-6">
                    {/* SELETORES DE VERSÃO */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2">
                            <Split className="w-5 h-5 text-blue-600" />
                            <h2 className="text-base font-bold text-slate-900">Comparar Duas Versões / Snapshots de Críticos</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-600">Versão A (Base / Anterior):</label>
                                <select
                                    value={compareVersaoAId}
                                    onChange={(e) => setCompareVersaoAId(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                                >
                                    <option value="">Selecione a Versão A...</option>
                                    {versoesList.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.titulo_versao || `Versão ${v.id}`} ({v.data_referencia || 'N/A'}) — {v.total_itens} itens
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-600">Versão B (Atual / Comparada):</label>
                                <select
                                    value={compareVersaoBId}
                                    onChange={(e) => setCompareVersaoBId(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                                >
                                    <option value="">Selecione a Versão B...</option>
                                    {versoesList.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.titulo_versao || `Versão ${v.id}`} ({v.data_referencia || 'N/A'}) — {v.total_itens} itens
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <button
                                    onClick={handleExecutarComparacao}
                                    disabled={compareLoading || !compareVersaoAId || !compareVersaoBId}
                                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {compareLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
                                    <span>Comparar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RESULTADO DA COMPARAÇÃO */}
                    {compareResult && (
                        <div className="space-y-5">
                            {/* CARDS COM MÉTRICAS DE DELTA */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                <div 
                                    onClick={() => setCompareFilterStatus('RESOLVIDOS')}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        compareFilterStatus === 'RESOLVIDOS' ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : 'bg-white hover:bg-emerald-50/20'
                                    } border-emerald-200 shadow-2xs`}
                                >
                                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Itens Resolvidos</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-2xl font-black text-emerald-700">{compareResult.resumo.resolvidos}</span>
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Ficaram OK ou saíram da falta</p>
                                </div>

                                <div 
                                    onClick={() => setCompareFilterStatus('NOVOS')}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        compareFilterStatus === 'NOVOS' ? 'ring-2 ring-rose-500 bg-rose-50/50' : 'bg-white hover:bg-rose-50/20'
                                    } border-rose-200 shadow-2xs`}
                                >
                                    <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Novos Críticos</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-2xl font-black text-rose-700">{compareResult.resumo.novosCriticos}</span>
                                        <AlertCircle className="w-5 h-5 text-rose-500" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Viraram falta ou entraram novos</p>
                                </div>

                                <div 
                                    onClick={() => setCompareFilterStatus('ALTERADOS')}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        compareFilterStatus === 'ALTERADOS' ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white hover:bg-blue-50/20'
                                    } border-blue-200 shadow-2xs`}
                                >
                                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Saldos Reduzidos</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className="text-2xl font-black text-blue-700">{compareResult.resumo.saldoReduzido}</span>
                                        <TrendingDown className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Diminuição da pendência</p>
                                </div>

                                <div 
                                    onClick={() => setCompareFilterStatus('ALL')}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        compareFilterStatus === 'ALL' ? 'ring-2 ring-slate-500 bg-slate-100' : 'bg-white hover:bg-slate-50'
                                    } border-slate-200 shadow-2xs`}
                                >
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Delta Faltantes Total</span>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <span className={`text-2xl font-black ${
                                            compareResult.resumo.deltaFaltantesLiquidos <= 0 ? 'text-emerald-700' : 'text-rose-700'
                                        }`}>
                                            {compareResult.resumo.deltaFaltantesLiquidos > 0 ? `+${compareResult.resumo.deltaFaltantesLiquidos}` : compareResult.resumo.deltaFaltantesLiquidos}
                                        </span>
                                        <BarChart2 className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Diferença de volume total</p>
                                </div>
                            </div>

                            {/* TABELA COMPARATIVA */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                                <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold">
                                    <span>Lista Comparativa ({filteredCompareItens.length} itens exibidos)</span>
                                    <span className="text-slate-500">
                                        Versão A: <strong className="text-slate-800">{compareResult.versaoA.titulo}</strong> ➔ Versão B: <strong className="text-slate-800">{compareResult.versaoB.titulo}</strong>
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                                            <tr>
                                                <th className="px-3 py-2.5">Código VMI</th>
                                                <th className="px-3 py-2.5">Código Metal</th>
                                                <th className="px-4 py-2.5 min-w-[200px]">Descrição</th>
                                                <th className="px-3 py-2.5 text-center">Status A</th>
                                                <th className="px-3 py-2.5 text-right">Faltante A</th>
                                                <th className="px-3 py-2.5 text-center">Status B</th>
                                                <th className="px-3 py-2.5 text-right">Faltante B</th>
                                                <th className="px-3 py-2.5 text-right font-black">Delta Saldo</th>
                                                <th className="px-3 py-2.5 text-center">Diagnóstico</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredCompareItens.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{it.codVmi}</td>
                                                    <td className="px-3 py-2.5 font-mono font-bold text-blue-700">{it.codMetalfisa || '-'}</td>
                                                    <td className="px-4 py-2.5 max-w-[250px] truncate" title={it.descricao}>{it.descricao || '-'}</td>
                                                    
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                            {it.versaoA.statusEntrega}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{it.versaoA.totalFaltantes}</td>

                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            it.versaoB.statusEntrega === 'MATERIAL OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {it.versaoB.statusEntrega}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-slate-900 font-bold">{it.versaoB.totalFaltantes}</td>

                                                    <td className={`px-3 py-2.5 text-right font-mono font-black ${
                                                        it.deltaFaltante < 0 ? 'text-emerald-700' : it.deltaFaltante > 0 ? 'text-rose-700' : 'text-slate-400'
                                                    }`}>
                                                        {it.deltaFaltante > 0 ? `+${it.deltaFaltante}` : it.deltaFaltante}
                                                    </td>

                                                    <td className="px-3 py-2.5 text-center">
                                                        {it.classificacao === 'RESOLVIDO_MATERIAL_OK' && (
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                                                                ✅ Resolvido (OK)
                                                            </span>
                                                        )}
                                                        {it.classificacao === 'NOVO_CRITICO' && (
                                                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold">
                                                                🚨 Virou Crítico
                                                            </span>
                                                        )}
                                                        {it.classificacao === 'SALDO_REDUZIDO' && (
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold">
                                                                📉 Saldo Reduzido
                                                            </span>
                                                        )}
                                                        {it.classificacao === 'SALDO_AUMENTADO' && (
                                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                                                                📈 Saldo Aumentou
                                                            </span>
                                                        )}
                                                        {it.classificacao === 'INALTERADO' && (
                                                            <span className="text-slate-400 text-[10px]">Inalterado</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA 3: CURVA DE EVOLUÇÃO                                                  */}
            {/* ========================================================================= */}
            {activeTab === 'evolucao' && (
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Curva de Redução de Faltantes & Atendimento</h2>
                                    <p className="text-xs text-slate-500">Histórico de queda do volume de peças críticas e evolução da taxa de atendimento.</p>
                                </div>
                            </div>
                            <button
                                onClick={carregarEvolucao}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                                title="Atualizar Gráficos"
                            >
                                <RefreshCw className={`w-4 h-4 ${evolucaoLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {evolucaoData.length < 2 ? (
                            <div className="p-12 text-center text-slate-400 space-y-2">
                                <BarChart2 className="w-10 h-10 mx-auto text-slate-300" />
                                <p className="text-sm font-semibold">Importe ao menos 2 versões para visualizar a Curva de Evolução.</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* GRÁFICO 1: VOLUME DE FALTANTES (PEÇAS) */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Queda no Volume de Faltantes (Peças)</h3>
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={evolucaoData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorFaltantes" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="data" stroke="#64748b" fontSize={11} />
                                                <YAxis stroke="#64748b" fontSize={11} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(val) => [Number(val).toLocaleString('pt-BR') + ' peças', 'Total Faltantes']}
                                                />
                                                <Legend />
                                                <Area type="monotone" dataKey="totalFaltantes" name="Faltantes Líquidos" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorFaltantes)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* GRÁFICO 2: TAXA DE ATENDIMENTO (%) E DISTRIBUIÇÃO */}
                                <div className="space-y-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Evolução da Taxa de Atendimento (%)</h3>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={evolucaoData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="data" stroke="#64748b" fontSize={11} />
                                                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} unit="%" />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                                                    formatter={(val) => [`${val}%`, 'Taxa de Atendimento']}
                                                />
                                                <Legend />
                                                <Line type="monotone" dataKey="taxaAtendimento" name="% Material OK" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA 4: IMPORTAR PLANILHA COM SELETOR DE ABAS                              */}
            {/* ========================================================================= */}
            {activeTab === 'importar' && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-slate-900">Importação de Nova Planilha de Críticos / Faltantes</h2>
                            <p className="text-xs sm:text-sm text-slate-500">
                                Carregue o arquivo Excel (`.xlsx`), selecione a aba correta com a prévia das colunas e grave o espelho histórico.
                            </p>
                        </div>

                        {/* ZONA DE DROP / SELEÇÃO DE ARQUIVO */}
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/60 p-8 rounded-2xl text-center cursor-pointer transition-all space-y-3"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <div className="w-14 h-14 bg-white rounded-2xl shadow-xs border border-blue-100 flex items-center justify-center mx-auto text-blue-600">
                                <UploadCloud className="w-7 h-7" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">
                                    {uploadFile ? uploadFile.name : 'Clique para selecionar a planilha Excel'}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : 'Suporta arquivos .xlsx como o 24-08.xlsx'}
                                </p>
                            </div>
                        </div>

                        {/* SELETOR DE ABA & PRÉVIA */}
                        {uploadSheetPreview && (
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 block">
                                        1. Selecione a Aba da Planilha a ser processada:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {uploadSheetPreview.sheets.map((sh, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedSheet(sh.name)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                                    selectedSheet === sh.name
                                                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                                }`}
                                            >
                                                <div className="truncate pr-2">
                                                    <span className="text-xs block truncate">{sh.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-normal">{sh.totalRows} linhas</span>
                                                </div>
                                                {sh.isSuggested && (
                                                    <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                                        Sugerida
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-700 block">
                                        2. Título da Versão (Snapshot):
                                    </label>
                                    <input
                                        type="text"
                                        value={customVersionTitle}
                                        onChange={(e) => setCustomVersionTitle(e.target.value)}
                                        placeholder="Ex: Posição de Críticos 24/08/2026"
                                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                {/* BOTÃO DE AÇÃO */}
                                <div className="pt-2">
                                    <button
                                        onClick={handleProcessarESalvar}
                                        disabled={uploading || !selectedSheet}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                                    >
                                        {uploading ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Cruzando dados com Protheus e Salvando Versão...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                <span>Processar Aba "{selectedSheet}" e Salvar Espelho</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ABA 5: HISTÓRICO DE SNAPSHOTS SALVOS                                      */}
            {/* ========================================================================= */}
            {activeTab === 'versoes' && (
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <h2 className="text-base font-bold text-slate-900 mb-4">Snapshots Históricos Salvos na Base de Dados</h2>
                        
                        {versoesList.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-8">Nenhuma versão gravada ainda.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                                        <tr>
                                            <th className="px-3 py-2.5">ID</th>
                                            <th className="px-3 py-2.5">Título da Versão</th>
                                            <th className="px-3 py-2.5">Arquivo & Aba</th>
                                            <th className="px-3 py-2.5 text-center">Data Ref.</th>
                                            <th className="px-3 py-2.5 text-right">Total Itens</th>
                                            <th className="px-3 py-2.5 text-right">Material OK</th>
                                            <th className="px-3 py-2.5 text-right text-rose-700">Falta Entrega</th>
                                            <th className="px-3 py-2.5">Enviado por</th>
                                            <th className="px-3 py-2.5 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {versoesList.map(v => (
                                            <tr key={v.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2.5 font-mono font-bold text-slate-400">#{v.id}</td>
                                                <td className="px-3 py-2.5 font-bold text-slate-900">{v.titulo_versao || `Versão ${v.id}`}</td>
                                                <td className="px-3 py-2.5 text-slate-600">
                                                    <span className="font-mono">{v.nome_arquivo}</span>
                                                    <span className="text-[10px] text-slate-400 block font-normal">Aba: {v.aba_selecionada}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center font-mono">{v.data_referencia || '-'}</td>
                                                <td className="px-3 py-2.5 text-right font-mono font-bold">{v.total_itens}</td>
                                                <td className="px-3 py-2.5 text-right font-mono text-emerald-700 font-bold">{v.total_ok}</td>
                                                <td className="px-3 py-2.5 text-right font-mono text-rose-700 font-bold">{v.total_pendente}</td>
                                                <td className="px-3 py-2.5 text-slate-600">{v.usuario_nome || '-'}</td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => carregarDetalhesVersao(v.id)}
                                                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors"
                                                            title="Visualizar Espelho"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            <span>Abrir</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleExcluirVersao(v.id, v.titulo_versao)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                            title="Excluir Versão"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}
