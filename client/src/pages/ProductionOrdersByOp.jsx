import React, { useState } from 'react';
import { Search, Loader2, Hash, AlertCircle, FileText } from 'lucide-react';
import { getProductionOrdersByOp } from '../services/api';
import DocsModal from '../components/DocsModal';

export default function ProductionOrdersByOp() {
    const [op, setOp] = useState('');
    const [item, setItem] = useState('');
    const [sequencia, setSequencia] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Estado para o Modal de Documentos
    const [docsModal, setDocsModal] = useState({ isOpen: false, code: null, name: null });

    const openDocs = (code, name) => {
        setDocsModal({ isOpen: true, code, name });
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!op.trim()) return;

        setLoading(true);
        setError(null);
        setHasSearched(true);
        setResults([]);

        try {
            if (op.length < 4) {
                setError('O número do pedido deve ter pelo menos 4 dígitos.');
                setLoading(false);
                return;
            }
            // Passa os parâmetros separados
            const data = await getProductionOrdersByOp(op, item, sequencia);
            setResults(data);
        } catch (err) {
            console.error(err);
            setError('Erro ao buscar dados da OP. Verifique o número e tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <DocsModal
                isOpen={docsModal.isOpen}
                onClose={() => setDocsModal({ ...docsModal, isOpen: false })}
                productCode={docsModal.code}
                productName={docsModal.name}
            />

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Consulta por OP
                    </h1>
                    <p className="text-slate-500">
                        Visualize a estrutura completa de uma Ordem de Produção específica.
                    </p>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                    <div className="flex items-center gap-2 font-semibold mb-1">
                        <AlertCircle className="h-4 w-4" />
                        <span>Entenda a numeração da OP:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 ml-1 text-blue-700/90 text-xs">
                        <li><strong>4 primeiros dígitos:</strong> Número do Pedido (Ex: 3664)</li>
                        <li><strong>Próximos 2 dígitos:</strong> Item do Pedido (Ex: 01)</li>
                        <li><strong>Últimos dígitos:</strong> Sequência da OP (Ex: 001)</li>
                    </ul>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 md:items-end">

                    {/* Pedido */}
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Pedido (4 dígitos) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={op}
                                onChange={(e) => setOp(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                placeholder="Ex: 3664"
                            />
                        </div>
                    </div>

                    {/* Item */}
                    <div className="w-24">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Nº OP ou Pedido *
                        </label>
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            placeholder="01"
                            maxLength={2}
                        />
                    </div>

                    {/* Sequência */}
                    <div className="w-24">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Seq.
                        </label>
                        <input
                            type="text"
                            value={sequencia}
                            onChange={(e) => setSequencia(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                            placeholder="001"
                            maxLength={3}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !op.trim()}
                        className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Buscar OP
                    </button>
                </form>
            </div>
            {/* Error Message */}
            {
                error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 text-sm border border-red-100">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                )
            }

            {/* Results Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3">OP Origem</th>
                                <th className="px-4 py-3 text-center w-16">Docs</th>
                                <th className="px-4 py-3">Pedido</th>
                                <th className="px-4 py-3">OP</th>
                                <th className="px-4 py-3">Item/Seq</th>
                                <th className="px-4 py-3">Nível</th>
                                <th className="px-4 py-3 pl-8">Estrutura (Código - Descrição)</th>
                                <th className="px-4 py-3 text-right">Qtd. Rel</th>
                                <th className="px-4 py-3 text-right">Qtd. Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="px-4 py-12 text-center text-slate-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                                        Carregando estrutura da OP...
                                    </td>
                                </tr>
                            ) : results.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-4 py-12 text-center text-slate-500">
                                        {hasSearched ? 'Nenhum registro encontrado para esta OP.' : 'Informe o número da OP e clique em Buscar.'}
                                    </td>
                                </tr>
                            ) : (
                                results.map((row, index) => (
                                    <tr
                                        key={index}
                                        className={`hover:bg-slate-50 transition-colors ${row.nivel === 0 ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                            {row.op_origem}
                                        </td>
                                        {/* Botão Docs */}
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => {
                                                    if (row.arquivos_count === 1 && row.primeiro_arquivo) {
                                                        // Abrir direto
                                                        window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(row.primeiro_arquivo)}`, '_blank');
                                                    } else {
                                                        openDocs(row.codnoarvore, row.descnoarvore);
                                                    }
                                                }}
                                                className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-all relative ${row.tem_arquivos
                                                    ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200'
                                                    : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                                    }`}
                                                title={row.tem_arquivos
                                                    ? `${row.arquivos_count} Documento(s) - Clique para abrir`
                                                    : "Ver Desenhos/Documentos"}
                                            >
                                                <FileText className="h-4 w-4" />
                                                {row.tem_arquivos && (
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                    </span>
                                                )}
                                            </button>
                                        </td>

                                        <td className="px-4 py-3 text-blue-700 font-bold text-xs">{row.pedido_venda || '-'}</td>
                                        <td className="px-4 py-3 font-medium text-slate-700">{row.op}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {row.item_op}/{row.sequen_op}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-block w-6 text-center rounded text-xs font-bold ${row.nivel === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                {row.nivel}
                                            </span>
                                        </td>

                                        {/* Estrutura Identada */}
                                        <td className="px-4 py-3">
                                            <div
                                                className="flex flex-col"
                                                style={{ paddingLeft: `${row.nivel * 24}px` }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {row.nivel > 0 && <span className="text-slate-300 text-xs">┕</span>}
                                                    <span className={`font-mono text-xs ${row.nivel === 0 ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>
                                                        {row.codnoarvore}
                                                    </span>
                                                </div>
                                                <span className={`text-sm ${row.nivel === 0 ? 'font-semibold text-slate-900' : 'text-slate-700 pl-3'}`}>
                                                    {row.descnoarvore}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-right text-slate-500 text-sm">
                                            {Number(row.qtdrelativabom).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800 text-sm">
                                            {Number(row.qtdtotalparaop).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
