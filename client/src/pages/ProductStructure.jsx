import React, { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Layers, Box, FileText, Database, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { getEstruturaProduto, getStockBalance, getProductRoute, getFileUrl } from '../services/api';
import ProductDocuments from '../components/ProductDocuments';
import StockModal from '../components/StockModal';

const ProductStructure = () => {
    const { codigo } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [structure, setStructure] = useState([]);
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(true);
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

    const handleGeneratePDF = () => {
        const doc = new jsPDF('landscape');
        const dataEmissao = new Date().toLocaleDateString('pt-BR');
        const horaEmissao = new Date().toLocaleTimeString('pt-BR');

        doc.setFontSize(8);
        doc.text(`SIGA/MATR225Cus/v.12\nHora...: ${horaEmissao} - Grupo de empresa: GRUPO METALFISA / Filial: METALFISA MATRIZ`, 14, 10);

        doc.setFontSize(10);
        doc.text("Relação Simplificada das Estruturas", doc.internal.pageSize.width / 2, 10, { align: 'center' });
        doc.text("ENGETRON ENG ELET IN", (doc.internal.pageSize.width / 2) + 50, 10);

        doc.setFontSize(8);
        doc.text(`Folha...: 1\nDT.Ref.: ${dataEmissao}\nEmissão: ${dataEmissao}`, doc.internal.pageSize.width - 14, 10, { align: 'right' });

        const tableColumn = ["ITEM", "TP", "NIVEL", "CODIGO", "DESCRICAO", "QTDE.NECESSARIA", "UM", "Rv Metalfisa", "Cod Prod Cliente", "Rv Cliente", "Restrição"];
        const tableRows = [];

        structure.forEach((item, index) => {
            const itemNum = String(index + 1).padStart(3, '0');
            const tp = item.tipo_produto || '';
            const nivelStr = String(item.nivel).padStart(2, '0');
            // Adding indentation
            const indent = "  ".repeat(item.nivel);
            const ref = item.referencias && item.referencias[0] ? item.referencias[0] : {};

            // Prefer frontend mapping overrides if available, otherwise fallback to item properties
            const revM = item.rev_metalfisa || ref.revisao || '';
            const codCliente = ref.desenho || '';
            const revC = item.rev_cliente || '';
            const restricao = item.is_restricted ? '[R]' : '';

            const rowData = [
                itemNum,
                tp,
                nivelStr,
                indent + item.codigo,
                item.descricao || '',
                parseFloat(item.qtd_necessaria || 0).toFixed(6),
                item.unidade || '',
                revM,
                codCliente,
                revC,
                restricao
            ];

            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            theme: 'plain',
            styles: { fontSize: 7, font: 'courier', cellPadding: 1 },
            headStyles: { fillColor: false, textColor: 20, fontStyle: 'bold', lineWidth: { bottom: 0.5 } },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 10 },
                2: { cellWidth: 15 },
                3: { cellWidth: 35 },
                4: { cellWidth: 80 },
                5: { cellWidth: 25, halign: 'right' },
                6: { cellWidth: 10 },
                7: { cellWidth: 20, halign: 'center' },
                8: { cellWidth: 35 },
                9: { cellWidth: 20, halign: 'center' },
                10: { cellWidth: 15, halign: 'center', textColor: '#eab308', fontStyle: 'bold' }
            },
            didParseCell: function (data) {
                // Highlight [R] restriction
                if (data.section === 'body' && data.column.index === 10 && data.cell.raw === '[R]') {
                    data.cell.styles.fillColor = '#fef08a'; // Yellow background highlight similar to image
                    data.cell.styles.textColor = '#854d0e';
                }
            },
            didDrawPage: function (data) {
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                doc.setFontSize(7);
                doc.setLineWidth(0.5);
                doc.line(14, pageHeight - 7, pageSize.width - 14, pageHeight - 7);
                doc.text("TOTVS | SmartClient", 14, pageHeight - 4);
                doc.text("TOTVS S/A", pageSize.width / 2, pageHeight - 4, { align: 'center' });
                doc.text(`- Hora Término: ${new Date().toLocaleTimeString('pt-BR')}`, pageSize.width - 14, pageHeight - 4, { align: 'right' });
            },
            margin: { top: 20, bottom: 10 }
        });

        doc.save(`Estrutura_${codigo}_${dataEmissao.replace(/\//g, '')}.pdf`);
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
                                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                            >
                                <Printer className="h-4 w-4" />
                                Emitir Relatório
                            </button>
                            <button
                                onClick={() => navigate(`/bom/${encodeURIComponent(codigo)}`)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                            >
                                <FileText className="h-4 w-4" />
                                Gerar Lista de Materiais (BOM)
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Componente / Estrutura</th>
                                    <th className="px-6 py-4">Código</th>
                                    <th className="px-6 py-4">Ref. Cliente</th>
                                    <th className="px-6 py-4 text-center">Saldo</th>
                                    <th className="px-6 py-4">UM</th>
                                    <th className="px-6 py-4 text-center">Nível</th>
                                    <th className="px-6 py-4 text-right">Qtd Nec.</th>
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
                                            <td className="px-6 py-3 font-mono text-xs text-gray-600">
                                                {item.codigo}
                                            </td>
                                            <td className="px-6 py-3 text-sm text-gray-600">
                                                {item.referencias && item.referencias.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {item.referencias.map((ref, idx) => (
                                                            <div key={idx} className="bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 w-fit">
                                                                <span className="font-mono font-bold text-gray-800 text-xs">{ref.desenho}</span>
                                                                {/* <span className="text-[10px] text-gray-500 block">{ref.cliente} {ref.revisao ? `(Rev ${ref.revisao})` : ''}</span> */}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-gray-600">
                                                        {balances[item.codigo] !== undefined
                                                            ? parseFloat(balances[item.codigo]).toLocaleString('pt-BR')
                                                            : '-'}
                                                    </span>
                                                    <button
                                                        onClick={() => setSelectedProductForStock({ codigo: item.codigo, descricao: item.descricao })}
                                                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-all"
                                                        title="Gerenciar Estoque"
                                                    >
                                                        <Database className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-gray-500">
                                                {item.unidade}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`
                                                inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                                ${item.nivel === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                                            `}>
                                                    {item.nivel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono font-medium">
                                                {(parseFloat(item.qtd_necessaria) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                            </td>
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
