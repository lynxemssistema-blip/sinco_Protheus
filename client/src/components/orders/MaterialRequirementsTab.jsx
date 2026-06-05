import React, { useState } from 'react';
import { Package, Loader2, AlertTriangle, CheckCircle, Database, FileText, FileSpreadsheet } from 'lucide-react';
import { api } from '../../services/api';
import { useFilters } from '../../contexts/FilterContext';
import { generateMrpPdf, generateMrpExcel } from '../../services/mrpReportGenerator';

const MaterialRequirementsTab = ({ setPageBlocking = () => {} }) => {
    const { orderFilters } = useFilters();
    const [loading, setLoading]       = useState(false);
    const [resultados, setResultados] = useState(null);
    const [error, setError]           = useState(null);
    const [progress, setProgress]     = useState('');
    const [exporting, setExporting]   = useState(null); // 'pdf' | 'excel' | null

    // Monta label dos filtros ativos para o cabeçalho do relatório
    const buildFiltrosLabel = () => {
        const parts = [];
        if (orderFilters.cliente)     parts.push(`Cliente: ${orderFilters.cliente}`);
        if (orderFilters.pedido)      parts.push(`Pedido: ${orderFilters.pedido}`);
        if (orderFilters.produto)     parts.push(`Produto: ${orderFilters.produto}`);
        if (orderFilters.dataInicial) parts.push(`De: ${orderFilters.dataInicial}`);
        if (orderFilters.dataFinal)   parts.push(`Até: ${orderFilters.dataFinal}`);
        if (orderFilters.tipo_item)   parts.push(`Tipo: ${orderFilters.tipo_item}`);
        return parts.join(' | ');
    };

    const handleExportPdf = async () => {
        if (!resultados) return;
        setExporting('pdf');
        try {
            generateMrpPdf(resultados, buildFiltrosLabel());
        } catch (e) {
            alert('Erro ao gerar PDF: ' + e.message);
        } finally {
            setExporting(null);
        }
    };

    const handleExportExcel = async () => {
        if (!resultados) return;
        setExporting('excel');
        try {
            generateMrpExcel(resultados, buildFiltrosLabel());
        } catch (e) {
            alert('Erro ao gerar Excel: ' + e.message);
        } finally {
            setExporting(null);
        }
    };

    const handleCalculate = async () => {
        setLoading(true);
        setError(null);
        setResultados(null);
        setProgress('Buscando pedidos...');
        setPageBlocking('Consultando pedidos com saldo a faturar no banco de dados...');

        try {
            // ETAPA 1: Usa rota dedicada e leve /materials/mrp-items (sem enriquecimento pesado)
            let itemsToProcess = [];
            let currentPage = 1;
            let hasMore = true;

            const baseParams = {
                cliente:      orderFilters.cliente      || '',
                pedido:       orderFilters.pedido       || '',
                produto:      orderFilters.produto      || '',
                dataInicial:  orderFilters.dataInicial  || '',
                dataFinal:    orderFilters.dataFinal    || '',
                dateType:     orderFilters.dateType     || 'pedido',
                tipo_item:    orderFilters.tipo_item    || '',
                limit: 500
            };

            while (hasMore) {
                const response = await api.get('/materials/mrp-items', {
                    params: { ...baseParams, page: currentPage }
                });

                const batch = response.data?.data || [];
                const total = response.data?.meta?.total || 0;
                itemsToProcess = [...itemsToProcess, ...batch];

                const msg = `Buscando pedidos... ${itemsToProcess.length} / ${total || '?'} itens`;
                setProgress(msg);
                setPageBlocking(msg);

                if (batch.length === 0 || itemsToProcess.length >= total) {
                    hasMore = false;
                } else {
                    currentPage++;
                }
            }

            if (itemsToProcess.length === 0) {
                setError('Nenhum item com saldo a faturar encontrado com os filtros atuais.');
                return;
            }

            // ETAPA 2: Aglutinar por produto (soma saldo a faturar de todas as linhas do mesmo produto)
            const produtoMap = {};
            itemsToProcess.forEach(item => {
                const cod = String(item.produto || '').trim();
                if (!cod) return;
                const qtd = parseFloat(item.qtd_faturar) || 0;
                if (qtd <= 0) return;
                if (!produtoMap[cod]) {
                    produtoMap[cod] = { produto: cod, qtd_total: 0 };
                }
                produtoMap[cod].qtd_total += qtd;
            });

            const bulkItems = Object.values(produtoMap);

            if (bulkItems.length === 0) {
                setError('Não há itens com saldo a faturar para processar.');
                return;
            }

            const blastMsg = `Explodindo estrutura de ${bulkItems.length} produtos e cruzando com estoque (Almox 01/03)...`;
            setProgress(blastMsg);
            setPageBlocking(blastMsg);

            // ETAPA 3: Explosão recursiva da BOM no Protheus
            const explosionRes = await api.post('/materials/bulk-explosion', { items: bulkItems });
            setResultados(explosionRes.data);
            setProgress('');

        } catch (err) {
            console.error('Erro ao calcular necessidades:', err);
            const detail = err.response?.data?.error || err.response?.data?.details || err.message;
            setError('Erro ao processar as necessidades: ' + detail);
            setProgress('');
        } finally {
            setLoading(false);
            setPageBlocking(null); // ← Libera a página
        }
    };

    return (
        <div className="p-6">
            <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Package className="w-5 h-5 text-blue-600" />
                            Explosão Consolidada de Necessidades (S&OP)
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                            Esta ferramenta varre todos os pedidos listados na tela de Visão Geral,
                            abre a estrutura de engenharia de cada um e aglutina a quantidade total
                            necessária de cada matéria-prima. O resultado é cruzado com o saldo atual
                            nos almoxarifados 01 e 03.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Botão principal: Calcular */}
                        <button
                            onClick={handleCalculate}
                            disabled={loading || !!exporting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                            {loading ? 'Calculando...' : 'Calcular Necessidades'}
                        </button>

                        {/* Botões de exportação — visíveis apenas quando há resultado */}
                        {resultados && (
                            <>
                                <button
                                    onClick={handleExportPdf}
                                    disabled={!!exporting || loading}
                                    title="Exportar PDF (A4 deitado, padrão MetalFisa)"
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                                >
                                    {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    PDF
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    disabled={!!exporting || loading}
                                    title="Exportar Excel (2 abas: completo + em aberto)"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                                >
                                    {exporting === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                    Excel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                    <p className="text-gray-500">{progress || 'Varrendo estruturas e aglutinando dados...'}</p>
                </div>
            )}

            {!loading && resultados && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
                            <span>Base: <strong className="text-gray-800">{resultados.items_base}</strong> produtos</span>
                            <span className="text-gray-300">|</span>
                            <span>MPs únicas: <strong className="text-blue-600">{resultados.materiais.length}</strong></span>
                            <span className="text-gray-300">|</span>
                            <span className="text-emerald-700">✅ OK: <strong>{resultados.materiais.filter(m => Number(m.necessidade_liquida) <= 0).length}</strong></span>
                            <span className="text-gray-300">|</span>
                            <span className="text-red-600">⚠️ Em aberto: <strong>{resultados.materiais.filter(m => Number(m.necessidade_liquida) > 0).length}</strong></span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Código MP</th>
                                    <th className="px-6 py-3 font-semibold">Descrição do Material</th>
                                    <th className="px-4 py-3 font-semibold text-center">Un</th>
                                    <th className="px-6 py-3 font-semibold text-right text-blue-800">Qtd Necessária</th>
                                    <th className="px-5 py-3 font-semibold text-right text-emerald-700">Almox 01 ★</th>
                                    <th className="px-5 py-3 font-semibold text-right text-teal-600">Almox 03</th>
                                    <th className="px-6 py-3 font-semibold text-right">Nec. Líquida</th>
                                    <th className="px-6 py-3 font-semibold text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {resultados.materiais.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                                            Nenhuma matéria-prima (MP, ME, MC) encontrada nas estruturas.
                                        </td>
                                    </tr>
                                ) : (
                                    resultados.materiais.map((mat, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-800">{mat.codigo}</td>
                                            <td className="px-6 py-3 text-gray-600 max-w-xs truncate" title={mat.descricao}>
                                                {mat.descricao}
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-500">{mat.unidade}</td>
                                            <td className="px-6 py-3 text-right font-bold text-blue-700">
                                                {Number(mat.qtd_total_necessaria).toFixed(2)}
                                            </td>
                                            {/* Almox 01 — base de cálculo da necessidade */}
                                            <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                                                {Number(mat.saldo_almox01).toFixed(2)}
                                            </td>
                                            {/* Almox 03 — informativo */}
                                            <td className="px-5 py-3 text-right text-teal-600">
                                                {Number(mat.saldo_almox03).toFixed(2)}
                                            </td>
                                            <td className={`px-6 py-3 text-right font-bold ${mat.necessidade_liquida > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {Number(mat.necessidade_liquida).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {mat.necessidade_liquida <= 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        <CheckCircle className="w-3.5 h-3.5" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Faltam {Number(mat.necessidade_liquida).toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialRequirementsTab;
