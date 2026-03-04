import React, { useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import ProductDocuments from '../components/ProductDocuments';
import { Search, Package, AlertCircle, Loader2, ChevronRight, Network, FileText, X, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

const WhereUsedPage = () => {
    const [searchCode, setSearchCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null); // For PDF modal

    const handleSearch = async () => {
        if (!searchCode.trim()) {
            setError('Por favor, informe o código do produto');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await axios.get(`/api/materials/where-used/${searchCode.trim()}`);
            setResult(response.data);
        } catch (err) {
            if (err.response?.status === 404) {
                setError('Produto não encontrado no sistema');
            } else {
                setError(err.response?.data?.error || 'Erro ao buscar informações');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto p-6 space-y-6">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <Network className="h-8 w-8 text-indigo-600 mr-3" />
                                Onde é Usado (Where-Used)
                            </h1>
                            <p className="text-gray-500 mt-1 ml-11">
                                Busca reversa: descubra em quais produtos um componente é utilizado
                            </p>
                        </div>
                    </div>

                    {/* Search Box */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-2">
                                    Código do Produto/Componente
                                </label>
                                <input
                                    type="text"
                                    className="w-full border-gray-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Ex: COMP001, PA123, etc."
                                    value={searchCode}
                                    onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                                    onKeyPress={handleKeyPress}
                                    disabled={loading}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Buscando...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="h-4 w-4" />
                                            Buscar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-red-900">Erro</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Product Info Header */}
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200 p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-white rounded-lg shadow-sm">
                                        <Package className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {result.productCode}
                                        </h2>
                                        <p className="text-gray-600 mt-1">{result.description}</p>
                                        <div className="flex gap-4 mt-2">
                                            <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                                                Tipo: <span className="font-semibold">{result.tipo}</span>
                                            </span>
                                            <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
                                                Unidade: <span className="font-semibold">{result.unidade}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* PDF Button for Searched Product */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (result.arquivos_count === 1 && result.primeiro_arquivo) {
                                                    window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(result.primeiro_arquivo)}`, '_blank');
                                                } else {
                                                    setSelectedProduct({ codigo: result.productCode, descricao: result.description });
                                                }
                                            }}
                                            className={`p-2 rounded-lg transition-all ${result.tem_arquivos
                                                    ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200'
                                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                }`}
                                            title={result.tem_arquivos ? `${result.arquivos_count} Documento(s)` : "Sem Documentos"}
                                        >
                                            <FileText className="h-4 w-4" />
                                        </button>
                                        <div className="text-right">
                                            <div className="text-3xl font-bold text-indigo-600">
                                                {result.totalUsages}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {result.totalUsages === 1 ? 'uso' : 'usos'} encontrado{result.totalUsages !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Results Content */}
                            <div className="p-6">
                                {result.totalUsages === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-lg font-medium">Este produto não é usado em nenhuma estrutura</p>
                                        <p className="text-sm mt-2">
                                            O produto pesquisado não aparece como componente de nenhum outro produto.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.keys(result.usedInByLevel).sort((a, b) => parseInt(a) - parseInt(b)).map(nivel => (
                                            <div key={nivel} className="space-y-3">
                                                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                                    <ChevronRight className="h-4 w-4 text-indigo-600" />
                                                    Nível {nivel}
                                                    <span className="text-xs text-gray-400 font-normal">
                                                        ({result.usedInByLevel[nivel].length} {result.usedInByLevel[nivel].length === 1 ? 'produto' : 'produtos'})
                                                    </span>
                                                </h3>
                                                <div className="grid grid-cols-1 gap-3 pl-6">
                                                    {result.usedInByLevel[nivel].map((item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all bg-white"
                                                        >
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="font-semibold text-gray-900">
                                                                        {item.produto_pai}
                                                                    </div>
                                                                    <div className="text-sm text-gray-600 mt-1">
                                                                        {item.descricao_produto_pai || 'Sem descrição'}
                                                                    </div>
                                                                    <div className="flex gap-3 mt-2">
                                                                        <span className="text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                                                            Tipo: <span className="font-medium">{item.tipo}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-start gap-2">
                                                                    {/* Structure Button */}
                                                                    <Link
                                                                        to={`/estrutura/${encodeURIComponent(item.produto_pai)}`}
                                                                        state={{ from: '/pcp/onde-usado' }}
                                                                        className="p-2 rounded-lg transition-all text-blue-600 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200"
                                                                        title="Ver Estrutura/Operações"
                                                                    >
                                                                        <Layers className="h-4 w-4" />
                                                                    </Link>
                                                                    {/* PDF Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (item.arquivos_count === 1 && item.primeiro_arquivo) {
                                                                                window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(item.primeiro_arquivo)}`, '_blank');
                                                                            } else {
                                                                                setSelectedProduct({ codigo: item.produto_pai, descricao: item.descricao_produto_pai });
                                                                            }
                                                                        }}
                                                                        className={`p-2 rounded-lg transition-all ${item.tem_arquivos
                                                                                ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200'
                                                                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                                            }`}
                                                                        title={item.tem_arquivos ? `${item.arquivos_count} Documento(s)` : "Sem Documentos"}
                                                                    >
                                                                        <FileText className="h-4 w-4" />
                                                                    </button>
                                                                    {/* Quantity Display */}
                                                                    <div className="text-right">
                                                                        <div className="text-lg font-bold text-indigo-600">
                                                                            {item.quantidade}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            {item.unidade}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}                </div>
            </div>

            {/* PDF Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-indigo-600" />
                                    Documentos do Produto
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedProduct.codigo} - {selectedProduct.descricao}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <ProductDocuments produtoCodigo={selectedProduct.codigo} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhereUsedPage;
