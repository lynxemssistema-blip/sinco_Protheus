import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Layers, Box, FileText, ChevronDown, ChevronRight, Printer, Download } from 'lucide-react';
import { getEstruturaProduto, getStockBalance, getProductRoute, getFileUrl } from '../services/api';
import ProductDocuments from '../components/ProductDocuments';
import StockModal from '../components/StockModal';
import { generateEstruturaReport } from '../services/estruturaReportPdf';
import { generateMergedDrawingsPdf } from '../services/pdfMergerService';

const ProductStructure = () => {
    const { codigo } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [structure, setStructure] = useState([]);
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [error, setError] = useState(null);
    const [selectedProductForStock, setSelectedProductForStock] = useState(null);
    const [expandedRoutes, setExpandedRoutes] = useState({}); // Track which items have route expanded
    const [routes, setRoutes] = useState({}); // Store routes for each product

    const fetchStructure = async () => {
        try {
            const data = await getEstruturaProduto(codigo);
            setStructure(data);
            await fetchBalances(data);
        } catch (err) {
            setError('Não foi possível carregar a estrutura deste produto.');
        } finally {
            setLoading(false);
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

    useEffect(() => {
        if (codigo) {
            fetchStructure();
        }
    }, [codigo]);

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
        generateMergedDrawingsPdf(structure, codigo);
    };

    const handleGeneratePDF = async () => {
        setIsGeneratingPdf(true);
        try {
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

            await generateEstruturaReport(structure, allRoutesMap);

        } catch (err) {
            console.error('Erro ao gerar relatório:', err);
            alert('Falha ao gerar o relatório. Consulte o console para mais detalhes.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={handleBack}
                    className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {backLabel}
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Layers className="h-6 w-6 text-blue-600" />
                                <h1 className="text-2xl font-bold text-gray-900">Estrutura do Produto</h1>
                            </div>
                            <p className="text-gray-500 font-mono bg-gray-100 inline-block px-2 py-1 rounded text-sm">
                                {codigo}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleGeneratePDF}
                                disabled={isGeneratingPdf}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm ${isGeneratingPdf ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'}`}
                            >
                                {isGeneratingPdf ? (
                                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                                ) : (
                                    <Printer className="h-4 w-4" />
                                )}
                                {isGeneratingPdf ? 'Gerando PDF...' : 'Emitir Relatório'}
                            </button>
                            <button
                                onClick={handleDownloadDrawings}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                            >
                                <Download className="h-4 w-4" />
                                Baixar Desenhos
                            </button>
                            <button
                                onClick={() => navigate(`/bom/${encodeURIComponent(codigo)}`)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                            >
                                <FileText className="h-4 w-4" />
                                Lista de Materiais
                            </button>
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
                                    <th className="px-6 py-4">Ref. Cliente</th>
                                    <th className="px-6 py-4 text-center">Roteiro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading && (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center">
                                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                        </td>
                                    </tr>
                                )}

                                {error && (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-red-500 font-medium">
                                            {error}
                                        </td>
                                    </tr>
                                )}

                                {!loading && !error && structure.map((item, idx) => (
                                    <Fragment key={idx}>
                                        <tr className={`hover:bg-slate-50 transition-colors ${item.nivel === 0 ? 'bg-blue-50/30' : ''}`}>
                                            
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
                                                                if (item.primeiro_arquivo) {
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
                                                <td colSpan="8" className="px-6 py-4">
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
                                                                        <th className="text-right py-2">Tempo Padrão (min)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="text-gray-700">
                                                                    {routes[item.codigo.trim()].map((op, opIdx) => (
                                                                        <tr key={opIdx} className="border-t border-gray-200">
                                                                            <td className="py-2 pr-4 font-mono font-bold text-blue-600">{op.operacao}</td>
                                                                            <td className="py-2 pr-4">{op.descricao?.trim() || '-'}</td>
                                                                            <td className="py-2 pr-4 font-mono">{op.recurso?.trim() || '-'}</td>
                                                                            <td className="py-2 pr-4 text-right font-mono">{op.tempo_setup || '0'}</td>
                                                                            <td className="py-2 text-right font-mono font-medium">{op.tempo_padrao || '0'}</td>
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
                                        <td colSpan="8" className="p-8 text-center text-gray-500">
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
            </div>
        </div>
    );
};

export default ProductStructure;
