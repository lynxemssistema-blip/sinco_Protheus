import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Layers, Box, FileText, ChevronDown, ChevronRight, Printer, Download, Stamp, PackageCheck, Loader2, X, History, RotateCcw, DollarSign, Wrench } from 'lucide-react';
import { getEstruturaProduto, getStockBalance, getProductRoute, getFileUrl, getSincoRestricoesSz0, getProductStatus, setProductStatus, getProductStatusesBatch, setProductStatusBatch, setEstruturaCustoOverride, removeEstruturaCustoOverride } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ProductDocuments from '../components/ProductDocuments';
import StockModal from '../components/StockModal';
import EngineeringReleaseModal from '../components/EngineeringReleaseModal';
import ProductStatusHistoryModal from '../components/ProductStatusHistoryModal';
import { generateEstruturaReport } from '../services/estruturaReportPdf';
import { generateMergedDrawingsPdf } from '../services/pdfMergerService';

const CUSTO_TIPOS = ['MP', 'MC', 'EM'];

const ProductStructure = () => {
    const { codigo } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [savingPreco, setSavingPreco] = useState({}); // { [itemCodigo]: true }
    const [structure, setStructure] = useState([]);
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isGeneratingPdfN1, setIsGeneratingPdfN1] = useState(false);
    const [error, setError] = useState(null);
    const [selectedProductForStock, setSelectedProductForStock] = useState(null);
    const [expandedRoutes, setExpandedRoutes] = useState({}); // Track which items have route expanded
    const [routes, setRoutes] = useState({}); // Store routes for each product
    const [showReleaseModal, setShowReleaseModal] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState(null);
    const [inclSubNiveisRestricao, setInclSubNiveisRestricao] = useState(false);
    const [productStatus, setProductStatusState] = useState('NORMAL');
    const [productStatuses, setProductStatuses] = useState({});
    const [showStatusHistory, setShowStatusHistory] = useState(false);
    const [historyModalCode, setHistoryModalCode] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const fetchStructure = async () => {
        try {
            setLoading(true);
            const data = await getEstruturaProduto(codigo);
            setStructure(data);

            try {
                const allCodes = [codigo, ...data.map(i => i.codigo)];
                const statusesMap = await getProductStatusesBatch(allCodes);
                setProductStatuses(statusesMap);
                setProductStatusState(statusesMap[codigo] || 'NORMAL');
            } catch (statusErr) {
                console.error("Erro ao buscar status do produto", statusErr);
            }

            await fetchBalances(data);
            fetchRoutesForAllItems(data);
        } catch (err) {
            setError('Não foi possível carregar a estrutura deste produto.');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoutesForAllItems = async (items) => {
        try {
            const routesMap = {};
            await Promise.all(items.map(async (item) => {
                const key = item.codigo?.trim();
                if (key) {
                    try {
                        const data = await getProductRoute(item.codigo);
                        routesMap[key] = Array.isArray(data) ? data : [];
                    } catch (e) {
                        routesMap[key] = [];
                    }
                }
            }));
            setRoutes(prev => ({ ...prev, ...routesMap }));
        } catch (e) {
            console.error('Erro ao pre-carregar roteiros:', e);
        }
    };

    const fetchBalances = async (items) => {
        const balancesMap = {};
        await Promise.all(items.map(async (item) => {
            try {
                const balanceData = await getStockBalance(item.codigo);
                balancesMap[item.codigo] = balanceData.saldo;
            } catch (e) {
                console.error(`Falha ao buscar saldo para ${item.codigo}`, e);
                balancesMap[item.codigo] = 0;
            }
        }));
        setBalances(balancesMap);
    };

    const toggleRoute = async (codigo) => {
        const key = codigo.trim();

        // If already expanded, just collapse
        if (expandedRoutes[key]) {
            setExpandedRoutes(prev => ({ ...prev, [key]: false }));
            return;
        }

        // If not fetched yet, fetch it
        if (!routes[key]) {
            try {
                const data = await getProductRoute(codigo);
                setRoutes(prev => ({ ...prev, [key]: Array.isArray(data) ? data : [] }));
            } catch (err) {
                console.error('Erro ao carregar roteiro:', err);
                setRoutes(prev => ({ ...prev, [key]: [] }));
            }
        }

        // Expand
        setExpandedRoutes(prev => ({ ...prev, [key]: true }));
    };

    const handleUpdateStatus = async (novoEstado) => {
        try {
            setIsUpdatingStatus(true);
            const user = JSON.parse(localStorage.getItem('@MetalFisa:user') || '{}');
            const usuarioNome = user?.nome || 'Desconhecido';
            
            // Build list of codes (PAI + all non-MP children)
            const targetCodes = [codigo];
            structure.forEach(item => {
                if (item.tipo_produto?.trim().toUpperCase() !== 'MP' && !targetCodes.includes(item.codigo)) {
                    targetCodes.push(item.codigo);
                }
            });

            await setProductStatusBatch(targetCodes, novoEstado, usuarioNome, 'MARCACAO_MANUAL_LOTE');
            
            setProductStatuses(prev => {
                const next = { ...prev };
                targetCodes.forEach(c => next[c] = novoEstado);
                return next;
            });
            setProductStatusState(novoEstado);
        } catch (err) {
            console.error('Erro ao atualizar status do produto:', err);
            alert('Falha ao atualizar o status do produto.');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleRowStatusChange = async (itemCodigo, novoEstado) => {
        try {
            setIsUpdatingStatus(true);
            const user = JSON.parse(localStorage.getItem('@MetalFisa:user') || '{}');
            const usuarioNome = user?.nome || 'Desconhecido';
            
            await setProductStatus(itemCodigo, novoEstado, usuarioNome, 'MARCACAO_MANUAL');
            
            setProductStatuses(prev => ({ ...prev, [itemCodigo]: novoEstado }));
            if (itemCodigo === codigo) setProductStatusState(novoEstado);
        } catch (err) {
            console.error('Erro ao atualizar status do item:', err);
            alert('Falha ao atualizar o status do item.');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    useEffect(() => {
        if (codigo) {
            fetchStructure();
        }
    }, [codigo]);

    // Custo é sempre um override ESCOPADO a este produto pai (codigo) — nunca altera
    // o preço padrão global do material, que continua o mesmo em qualquer outra estrutura.
    const handleUpdatePreco = async (itemCodigo, novoPreco) => {
        const precoNum = parseFloat(novoPreco);
        if (isNaN(precoNum) || precoNum < 0) return;

        setSavingPreco(prev => ({ ...prev, [itemCodigo]: true }));
        try {
            const user = JSON.parse(localStorage.getItem('@MetalFisa:user') || '{}');
            await setEstruturaCustoOverride(codigo, itemCodigo, precoNum, user?.nome);
            setStructure(prev => prev.map(i =>
                i.codigo.trim() === itemCodigo.trim()
                    ? { ...i, preco_override: precoNum, preco_efetivo: precoNum }
                    : i
            ));
        } catch (err) {
            console.error('Erro ao salvar custo do componente:', err);
            alert('Falha ao salvar o custo do componente.');
        } finally {
            setSavingPreco(prev => { const next = { ...prev }; delete next[itemCodigo]; return next; });
        }
    };

    const handleResetPreco = async (itemCodigo) => {
        setSavingPreco(prev => ({ ...prev, [itemCodigo]: true }));
        try {
            await removeEstruturaCustoOverride(codigo, itemCodigo);
            setStructure(prev => prev.map(i =>
                i.codigo.trim() === itemCodigo.trim()
                    ? { ...i, preco_override: null, preco_efetivo: i.preco_padrao }
                    : i
            ));
        } catch (err) {
            console.error('Erro ao remover custo do componente:', err);
            alert('Falha ao aplicar o preço padrão.');
        } finally {
            setSavingPreco(prev => { const next = { ...prev }; delete next[itemCodigo]; return next; });
        }
    };

    // Soma só as peças-folha (MP/MC/EM) para não contar o custo do intermediário
    // (PI/PA) e dos componentes dele ao mesmo tempo.
    const custoTotalEstrutura = structure.reduce((acc, item) => {
        const isCustoItem = item.eh_item_custo ?? CUSTO_TIPOS.includes((item.tipo_produto || '').toUpperCase());
        if (!isCustoItem) return acc;
        const qtd = parseFloat(item.qtd_necessaria) || 0;
        const preco = parseFloat(item.preco_efetivo) || 0;
        return acc + (qtd * preco);
    }, 0);

    // Soma o custo das operações de recursos/mão de obra de todas as peças
    const custoTotalRecursos = React.useMemo(() => {
        let total = 0;
        structure.forEach(item => {
            const key = item.codigo?.trim();
            const route = routes[key];
            if (Array.isArray(route)) {
                const qtdItem = parseFloat(item.qtd_necessaria || 1);
                const itemRecursoCost = route.reduce((sum, op) => sum + (parseFloat(op.custo_total_op) || 0), 0);
                total += (itemRecursoCost * qtdItem);
            }
        });
        return total;
    }, [structure, routes]);

    const custoTotalGeral = custoTotalEstrutura + custoTotalRecursos;

    // Função para calcular indentação visual baseada no nível
    const getPadding = (nivel) => {
        return nivel * 24; // 24px por nível
    };

    // Determinar destino do botão voltar
    const handleBack = () => {
        if (location.state?.from) {
            navigate(location.state.from);
        } else {
            navigate(-1);
        }
    };

    const backLabel = 'Voltar';

    const handleDownloadDrawings = () => {
        generateMergedDrawingsPdf(structure, codigo, productStatuses);
    };

    const handleGeneratePDF = async () => {
        setIsGeneratingPdf(true);
        try {
            // Busca restrições detalhadas SZ0 para o produto principal
            let sz0Records = [];
            try {
                if (codigo) {
                    const rSz0 = await getSincoRestricoesSz0(codigo.trim().toUpperCase());
                    sz0Records = Array.isArray(rSz0) ? rSz0 : [];
                }
            } catch (err) {
                console.error("Erro ao buscar restrições SZ0 do produto principal:", err);
            }

            // Pré-busca roteiros de todos os itens em paralelo
            const allRoutesMap = { ...routes };
            const missing = structure.filter(item => !allRoutesMap[item.codigo?.trim()]);

            await Promise.all(missing.map(async (item) => {
                const key = item.codigo?.trim();
                try {
                    const data = await getProductRoute(item.codigo);
                    allRoutesMap[key] = Array.isArray(data) ? data : [];
                } catch {
                    allRoutesMap[key] = [];
                }
            }));

            // Atualiza o cache de roteiros na tela também
            setRoutes(allRoutesMap);

            await generateEstruturaReport(structure, allRoutesMap, { sz0Records, productStatuses });

        } catch (err) {
            console.error('Erro ao gerar relatório:', err);
            alert('Falha ao gerar o relatório. Consulte o console para mais detalhes.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleGenerateNivel1PDF = async () => {
        setIsGeneratingPdfN1(true);
        try {
            // Busca restrições detalhadas SZ0 para o produto principal
            let sz0Records = [];
            try {
                if (codigo) {
                    const rSz0 = await getSincoRestricoesSz0(codigo.trim().toUpperCase());
                    sz0Records = Array.isArray(rSz0) ? rSz0 : [];
                }
            } catch (err) {
                console.error("Erro ao buscar restrições SZ0 do produto principal:", err);
            }

            // Somente nível 0 e nivel 1
            const filteredStructure = structure.filter(item => item.nivel === 0 || item.nivel === 1);

            const allRoutesMap = { ...routes };
            const missing = filteredStructure.filter(item => !allRoutesMap[item.codigo?.trim()]);

            await Promise.all(missing.map(async (item) => {
                const key = item.codigo?.trim();
                try {
                    const data = await getProductRoute(item.codigo);
                    allRoutesMap[key] = Array.isArray(data) ? data : [];
                } catch {
                    allRoutesMap[key] = [];
                }
            }));

            setRoutes(allRoutesMap);

            await generateEstruturaReport(filteredStructure, allRoutesMap, {
                title: 'ESTRUTURA COMPACTA (NÍVEL 1) — MATR225Cus',
                footerTitle: 'Estrutura Compacta (Nível 1)',
                isNivel1: true,
                includeSubLevelRestrictions: inclSubNiveisRestricao,
                sz0Records,
                productStatuses
            });

        } catch (err) {
            console.error('Erro ao gerar relatório N1:', err);
            alert('Falha ao gerar o relatório. Consulte o console para mais detalhes.');
        } finally {
            setIsGeneratingPdfN1(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="w-full">
                <button
                    onClick={handleBack}
                    className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {backLabel}
                </button>

                <div className={`bg-white rounded-xl shadow-sm border overflow-hidden mb-6 transition-colors ${
                    productStatus === 'NOVO' ? 'border-green-300 ring-1 ring-green-100' :
                    productStatus === 'REVISAO' ? 'border-yellow-400 ring-1 ring-yellow-100' :
                    'border-gray-100'
                }`}>
                    <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        productStatus === 'NOVO' ? 'bg-green-50/50 border-green-100' :
                        productStatus === 'REVISAO' ? 'bg-yellow-50/50 border-yellow-200' :
                        'bg-white border-gray-100'
                    }`}>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Layers className={`h-6 w-6 ${
                                    productStatus === 'NOVO' ? 'text-green-600' :
                                    productStatus === 'REVISAO' ? 'text-yellow-600' :
                                    'text-blue-600'
                                }`} />
                                <h1 className="text-2xl font-bold text-gray-900">Estrutura do Produto</h1>
                                {productStatus === 'NOVO' && (
                                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ml-2 shadow-sm border border-green-200">Novo</span>
                                )}
                                {productStatus === 'REVISAO' && (
                                    <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ml-2 shadow-sm border border-yellow-200">Revisão</span>
                                )}
                            </div>
                            <p className="text-gray-500 font-mono inline-block px-2 py-1 rounded text-sm shadow-sm border border-gray-100 bg-white">
                                {codigo}
                            </p>
                            {canViewValues && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm" title="Custo dos materiais folha (MP / MC / EM)">
                                        <DollarSign className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                        <span>Custo Materiais (MP/MC/EM): <strong>{custoTotalEstrutura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                    </div>
                                    <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm" title="Custo de Operações / Recursos (Horas x Taxas)">
                                        <Wrench className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                        <span>Custo Recursos / Mão de Obra: <strong>{custoTotalRecursos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                    </div>
                                    <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-900 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm" title="Custo Total Geral da Estrutura (Materiais + Recursos)">
                                        <DollarSign className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                        <span>Custo Total Estrutura: <strong>{custoTotalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                            {/* Controle de Status */}
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <button
                                    onClick={() => handleUpdateStatus('NOVO')}
                                    disabled={isUpdatingStatus}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${
                                        productStatus === 'NOVO' ? 'bg-green-500 text-white' : 'hover:bg-green-50 text-green-700'
                                    }`}
                                >
                                    Novo
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus('REVISAO')}
                                    disabled={isUpdatingStatus}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${
                                        productStatus === 'REVISAO' ? 'bg-yellow-400 text-yellow-900' : 'hover:bg-yellow-50 text-yellow-700'
                                    }`}
                                >
                                    Revisão
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus('NORMAL')}
                                    disabled={isUpdatingStatus}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${
                                        productStatus === 'NORMAL' ? 'bg-gray-200 text-gray-700' : 'hover:bg-gray-100 text-gray-500'
                                    }`}
                                >
                                    Normal
                                </button>
                                <div className="h-5 w-px bg-slate-200 mx-1"></div>
                                <button
                                    onClick={() => setShowStatusHistory(true)}
                                    title="Ver histórico de status"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                >
                                    <History className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Bloco de Relatórios */}
                            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                <button
                                    onClick={handleGenerateNivel1PDF}
                                    disabled={isGeneratingPdfN1}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm ${isGeneratingPdfN1 ? 'bg-amber-50/50 text-gray-400 cursor-not-allowed border-transparent' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'}`}
                                >
                                    {isGeneratingPdfN1 ? (
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-amber-600 rounded-full animate-spin" />
                                    ) : (
                                        <Layers className="h-4 w-4" />
                                    )}
                                    {isGeneratingPdfN1 ? 'Gerando...' : 'Nível 1'}
                                </button>

                                <label className="flex items-center gap-1.5 cursor-pointer select-none group pr-2">
                                    <input
                                        type="checkbox"
                                        checked={inclSubNiveisRestricao}
                                        onChange={e => setInclSubNiveisRestricao(e.target.checked)}
                                        className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                                    />
                                    <span className="text-[11px] font-medium text-slate-600 group-hover:text-amber-700 transition-colors whitespace-nowrap">
                                        Restrições (Nv.01+)
                                    </span>
                                </label>

                                <div className="hidden sm:block h-6 w-px bg-slate-300 mx-1"></div>

                                <button
                                    onClick={handleGeneratePDF}
                                    disabled={isGeneratingPdf}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm ${isGeneratingPdf ? 'bg-white/50 text-gray-400 cursor-not-allowed border-transparent' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'}`}
                                >
                                    {isGeneratingPdf ? (
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                    ) : (
                                        <Printer className="h-4 w-4" />
                                    )}
                                    {isGeneratingPdf ? 'Gerando...' : 'Relatório Completo'}
                                </button>
                            </div>

                            {/* Restante das Ações */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handleDownloadDrawings}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                                >
                                    <Download className="h-4 w-4" />
                                    Desenhos
                                </button>
                                <button
                                    onClick={async () => {
                                        // Pre-fetch all routes before opening modal
                                        const allRoutesMap = { ...routes };
                                        const missing = structure.filter(item => !allRoutesMap[item.codigo?.trim()]);
                                        await Promise.all(missing.map(async (it) => {
                                            const key = it.codigo?.trim();
                                            try {
                                                const data = await getProductRoute(it.codigo);
                                                allRoutesMap[key] = Array.isArray(data) ? data : [];
                                            } catch {
                                                allRoutesMap[key] = [];
                                            }
                                        }));
                                        setRoutes(allRoutesMap);
                                        setShowReleaseModal(true);
                                    }}
                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                                >
                                    <Stamp className="h-4 w-4" />
                                    Liberação
                                </button>
                                <button
                                    onClick={() => navigate(`/bom/${encodeURIComponent(codigo)}`)}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                                >
                                    <FileText className="h-4 w-4" />
                                    BOM
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-center">Nível</th>
                                    <th className="px-6 py-4">Código</th>
                                    <th className="px-6 py-4">Descrição</th>
                                    <th className="px-6 py-4">UM</th>
                                    <th className="px-6 py-4 text-right">Qtd Nec.</th>
                                    {canViewValues && <th className="px-6 py-4 text-right" title="Custo por unidade — editável, vale só nesta estrutura">Custo Unit. (R$)</th>}
                                    {canViewValues && <th className="px-6 py-4 text-right" title="Qtd Nec. × Custo Unit.">Custo Total (R$)</th>}
                                    <th className="px-6 py-4">Ref. Cliente</th>
                                    <th className="px-6 py-4 text-center">Status Eng.</th>
                                    <th className="px-6 py-4 text-center">Roteiro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading && (
                                    <tr>
                                        <td colSpan={canViewValues ? 11 : 9} className="p-8 text-center">
                                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                        </td>
                                    </tr>
                                )}

                                {error && (
                                    <tr>
                                        <td colSpan={canViewValues ? 11 : 9} className="p-8 text-center text-red-500 font-medium">
                                            {error}
                                        </td>
                                    </tr>
                                )}

                                {!loading && !error && structure.map((item, idx) => (
                                    <Fragment key={idx}>
                                        <tr className={`transition-colors ${
                                            productStatuses[item.codigo] === 'NOVO' ? 'bg-green-50/50 hover:bg-green-100/50' : 
                                            productStatuses[item.codigo] === 'REVISAO' ? 'bg-yellow-50/50 hover:bg-yellow-100/50' : 
                                            item.nivel === 0 ? 'bg-blue-50/30 hover:bg-blue-50' : 'hover:bg-slate-50'
                                        }`}>
                                            
                                            {/* Nível */}
                                            <td className="px-6 py-3 text-center">
                                                <span className={`
                                                inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                                ${item.nivel === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                                            `}>
                                                    {item.nivel}
                                                </span>
                                            </td>
                                            
                                            {/* Código */}
                                            <td className="px-6 py-3 font-mono text-xs text-gray-600">
                                                {item.codigo}
                                            </td>
                                            
                                            {/* Descrição (Componente / Estrutura) */}
                                            <td className="px-6 py-3">
                                                <div
                                                    className="flex items-center gap-2"
                                                    style={{ paddingLeft: `${getPadding(item.nivel)}px` }}
                                                >
                                                    {item.nivel > 0 && (
                                                        <div className="w-4 h-px bg-gray-300 mr-1"></div>
                                                    )}

                                                    {/* ICON LOGIC */}
                                                    {item.nivel === 0 ? (
                                                        <Box className="h-4 w-4 text-blue-600 shrink-0" />
                                                    ) : item.tem_arquivos ? (
                                                        // HAS PDF -> RED ICON + CLICK
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (item.arquivos && item.arquivos.length > 1) {
                                                                    setSelectedFiles(item.arquivos);
                                                                } else if (item.primeiro_arquivo) {
                                                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.primeiro_arquivo)}`), '_blank');
                                                                }
                                                            }}
                                                            className="hover:bg-red-50 p-0.5 rounded transition-colors"
                                                            title="Abrir Desenho/PDF"
                                                        >
                                                            <FileText className="h-4 w-4 text-red-500 shrink-0" />
                                                        </button>
                                                    ) : (
                                                        // NO PDF -> GRAY ICON
                                                        <FileText className="h-4 w-4 text-gray-300 shrink-0" />
                                                    )}

                                                    <span className={`font-medium ${item.nivel === 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                                                        {item.descricao || '(Sem Descrição)'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Unidade (UM) */}
                                            <td className="px-6 py-3 text-gray-500">
                                                {item.unidade}
                                            </td>

                                            {/* Qtd Nec. */}
                                            <td className="px-6 py-3 text-right font-mono font-medium">
                                                {(parseFloat(item.qtd_necessaria) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                            </td>

                                            {/* Custo Unit. (editável, override escopado a este produto pai) */}
                                            {canViewValues && (
                                                <td className="px-6 py-3 text-right">
                                                    {item.nivel === 0 ? (
                                                        <span className="text-gray-300">-</span>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                defaultValue={item.preco_efetivo}
                                                                key={`${item.codigo}-${item.preco_efetivo}`}
                                                                disabled={!!savingPreco[item.codigo]}
                                                                onBlur={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (!isNaN(val) && val !== parseFloat(item.preco_efetivo)) {
                                                                        handleUpdatePreco(item.codigo, val);
                                                                    }
                                                                }}
                                                                className={`w-24 text-right p-1 border rounded text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${
                                                                    item.preco_override != null
                                                                        ? 'border-amber-400 bg-amber-50 font-bold text-amber-800'
                                                                        : 'border-gray-200 text-gray-700'
                                                                }`}
                                                                title={item.preco_override != null ? `Custo alterado só nesta estrutura (padrão: ${(item.preco_padrao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : 'Custo padrão (Protheus)'}
                                                            />
                                                            {item.preco_override != null && (
                                                                <button
                                                                    onClick={() => handleResetPreco(item.codigo)}
                                                                    disabled={!!savingPreco[item.codigo]}
                                                                    title="Aplicar preço padrão"
                                                                    className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                                                                >
                                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}

                                            {/* Custo Total = Qtd Nec. × Custo Unit. (só destacado para itens de custo MP/MC/EM) */}
                                            {canViewValues && (
                                                <td className={`px-6 py-3 text-right font-mono ${item.eh_item_custo ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>
                                                    {item.nivel === 0 ? (
                                                        <span className="text-gray-300">-</span>
                                                    ) : (
                                                        ((parseFloat(item.qtd_necessaria) || 0) * (parseFloat(item.preco_efetivo) || 0))
                                                            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                                    )}
                                                </td>
                                            )}

                                            {/* Ref. Cliente */}
                                            <td className="px-6 py-3 text-sm text-gray-600">
                                                {item.referencias && item.referencias.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {item.referencias.map((ref, idx) => (
                                                            <div key={idx} className="bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 w-fit">
                                                                <span className="font-mono font-bold text-gray-800 text-xs">{ref.desenho}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>

                                            {/* Status Eng. (Dropdown) */}
                                            <td className="px-6 py-3 whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    <select 
                                                        value={productStatuses[item.codigo] || 'NORMAL'}
                                                        onChange={(e) => handleRowStatusChange(item.codigo, e.target.value)}
                                                        disabled={isUpdatingStatus}
                                                        className={`text-[10px] font-bold rounded-sm px-1 py-1 border transition-colors cursor-pointer appearance-none text-center shadow-sm ${
                                                            productStatuses[item.codigo] === 'NOVO' ? 'bg-green-100 text-green-800 border-green-300' :
                                                            productStatuses[item.codigo] === 'REVISAO' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                                            'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <option value="NORMAL" className="bg-white text-gray-700">NORMAL</option>
                                                        <option value="NOVO" className="bg-white text-green-700">NOVO</option>
                                                        <option value="REVISAO" className="bg-white text-yellow-700">REVISÃO</option>
                                                    </select>
                                                    <button 
                                                        onClick={() => { setHistoryModalCode(item.codigo); setShowStatusHistory(true); }}
                                                        className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                                        title="Histórico de Status"
                                                    >
                                                        <History className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Roteiro */}
                                            <td className="px-6 py-3 text-center">
                                                <button
                                                    onClick={() => toggleRoute(item.codigo)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                                    title="Ver Roteiro"
                                                >
                                                    {expandedRoutes[item.codigo.trim()] ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Route Details Row */}
                                        {expandedRoutes[item.codigo.trim()] && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={canViewValues ? 11 : 9} className="px-6 py-4">
                                                    <div className="pl-8">
                                                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Roteiro de Fabricação</div>
                                                        {!routes[item.codigo.trim()] || routes[item.codigo.trim()].length === 0 ? (
                                                            <div className="text-sm text-gray-400 italic">Sem roteiro cadastrado</div>
                                                        ) : (
                                                                                           <table className="min-w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-gray-500">
                                                                        <th className="text-left py-2 pr-4">Op</th>
                                                                        <th className="text-left py-2 pr-4">Descrição</th>
                                                                        <th className="text-left py-2 pr-4">Recurso</th>
                                                                        <th className="text-right py-2 pr-4">Setup (min)</th>
                                                                        <th className="text-right py-2 pr-4">Tempo Padrão (min)</th>
                                                                        {canViewValues && (
                                                                            <>
                                                                                <th className="text-right py-2 pr-4">Taxa Recurso (R$/min)</th>
                                                                                <th className="text-right py-2">Custo Op. (R$)</th>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="text-gray-700">
                                                                    {routes[item.codigo.trim()].map((op, opIdx) => (
                                                                        <tr key={opIdx} className="border-t border-gray-200">
                                                                            <td className="py-2 pr-4 font-mono font-bold text-blue-600">{op.operacao}</td>
                                                                            <td className="py-2 pr-4">{op.descricao?.trim() || '-'}</td>
                                                                            <td className="py-2 pr-4 font-mono">{op.recurso?.trim() || '-'}</td>
                                                                            <td className="py-2 pr-4 text-right font-mono">{op.tempo_setup || '0'}</td>
                                                                            <td className="py-2 pr-4 text-right font-mono font-medium">{op.tempo_padrao || '0'}</td>
                                                                            {canViewValues && (
                                                                                <>
                                                                                    <td className="py-2 pr-4 text-right font-mono text-gray-500">
                                                                                        {(parseFloat(op.taxa_padrao_min) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </td>
                                                                                    <td className="py-2 text-right font-mono font-bold text-emerald-700">
                                                                                        {(parseFloat(op.custo_total_op) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </td>
                                                                                </>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}

                                {!loading && !error && structure.length === 0 && (
                                    <tr>
                                        <td colSpan={canViewValues ? 11 : 9} className="p-8 text-center text-gray-500">
                                            Nenhum item encontrado na estrutura (BOM).
                                            <br />
                                            <span className="text-xs text-gray-400">Verifique se o produto possui cadastro na SG1.</span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Seção de Documentos - Integrada com MySQL externo */}
                <ProductDocuments produtoCodigo={codigo} />

                {/* Modal de Estoque */}
                <StockModal
                    isOpen={!!selectedProductForStock}
                    onClose={() => {
                        setSelectedProductForStock(null);
                        // Refresh balances when modal closes
                        fetchBalances(structure);
                    }}
                    productCode={selectedProductForStock?.codigo}
                    productName={selectedProductForStock?.descricao}
                />

                {/* Modal de Liberação de Engenharia */}
                {(() => {
                    const searchParams = new URLSearchParams(location.search);
                    const queryPedido = searchParams.get('pedido') || '';
                    const queryItem = searchParams.get('item') || '';
                    return (
                        <EngineeringReleaseModal
                            isOpen={showReleaseModal}
                            onClose={() => setShowReleaseModal(false)}
                            structure={structure}
                            routesMap={routes}
                            codigo={codigo}
                            initialPedido={location.state?.pedido || queryPedido}
                            initialItem={location.state?.item || queryItem}
                            productStatuses={productStatuses}
                            onReleaseSuccess={fetchStructure}
                        />
                    );
                })()}

                {/* Modal de Arquivos Múltiplos */}
                {selectedFiles && selectedFiles.length > 0 && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl border w-full max-w-md overflow-hidden animate-fadeIn">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    Arquivos Disponíveis
                                </h2>
                                <button
                                    onClick={() => setSelectedFiles(null)}
                                    className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {selectedFiles.map((fileUrl, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(fileUrl)}`), '_blank');
                                                setSelectedFiles(null);
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                                        >
                                            <span className="font-medium text-gray-700 group-hover:text-blue-700 truncate max-w-[90%] text-sm" title={fileUrl.split('/').pop()}>
                                                {fileUrl.split('/').pop()}
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Histórico de Status */}
                <ProductStatusHistoryModal
                    isOpen={showStatusHistory}
                    onClose={() => setShowStatusHistory(false)}
                    codigo={historyModalCode || codigo}
                />
            </div>
        </div>
    );
};

export default ProductStructure;
