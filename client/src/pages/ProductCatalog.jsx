import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Package, Layers, ChevronLeft, ChevronRight, Database, FileText, X, FolderInput, FileSpreadsheet } from 'lucide-react';
import { getProdutos, saveProductImage, getFileUrl } from '../services/api';
import { useFilters } from '../contexts/FilterContext';
import ProductDocuments from '../components/ProductDocuments';
import StockModal from '../components/StockModal';
import BulkImportModal from '../components/BulkImportModal';
import ProductAssociationsModal from '../components/ProductAssociationsModal';
import ProductImageModal from '../components/ProductImageModal';
import { importProductWeights } from '../services/api'; // Import function
import * as XLSX from 'xlsx';

const ProductCatalog = () => {
    const { productFilters, updateProductFilters } = useFilters();
    const { search, page } = productFilters;

    // Estados locais apenas para dados carregados e UI
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null); // Para Documentos
    const [selectedProductForStock, setSelectedProductForStock] = useState(null); // Para Estoque
    const [selectedProductForAssoc, setSelectedProductForAssoc] = useState(null); // Para Associações
    const [selectedProductForImage, setSelectedProductForImage] = useState(null); // Para Imagem
    const [openMenuProductId, setOpenMenuProductId] = useState(null); // State for dropdown menu
    const [showImportModal, setShowImportModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPages, setTotalPages] = useState(1);

    const limit = 20;

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, meta } = await getProdutos({
                ...productFilters,
                limit
            });
            setProducts(data);
            setTotalPages(Math.ceil(meta.total / limit));
        } catch (err) {
            setError('Erro ao carregar produtos. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Effect para carregar ao montar ou mudar página/busca no contexto
    useEffect(() => {
        fetchProducts();
    }, [search, page, productFilters]);

    const handleSearchChange = (e) => {
        updateProductFilters({ search: e.target.value, page: 1 });
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateProductFilters({ page: newPage });
        }
    };

    const handleExportExcel = async () => {
        try {
            setLoading(true);
            const { data } = await getProdutos({
                ...productFilters,
                limit: 999999, // Fetch amostral grande para burlar a paginação visual
                page: 1
            });

            if (!data || data.length === 0) {
                alert('Nenhum dado encontrado com o filtro atual para exportar.');
                return;
            }

            // Mapeando dados para a planilha
            const excelData = data.map(item => {
                const temRefs = item.referencias && item.referencias.length > 0;
                return {
                    'Código': item.codigo,
                    'Descrição': item.descricao,
                    'Cliente': temRefs ? item.referencias.map(r => r.cliente).filter(Boolean).join(' - ') : '',
                    'Cód. Prod. Cliente': temRefs ? item.referencias.map(r => r.desenho).filter(Boolean).join(' - ') : '',
                    'Rev. Cliente': temRefs ? item.referencias.map(r => r.revisao).filter(Boolean).join(' - ') : '',
                    'Tipo': item.tipo,
                    'UM': item.unidade,
                    'Grupo': item.grupo,
                    'Peso (kg)': item.metadados?.peso_kg ? Number(item.metadados.peso_kg) : '',
                    'Operação': item.metadados?.operacao || '',
                    'Op c/ Doc.': item.tem_arquivos ? 'Sim' : 'Não',
                    'Estoque Total': item.estoque_total || 0,
                    'Associações (Qtd)': item.associacoes?.length || 0
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Largura de Colunas para ficar legível
            ws['!cols'] = [
                { wch: 15 }, // Codigo
                { wch: 45 }, // Descricao
                { wch: 30 }, // Cliente
                { wch: 20 }, // Cód. Prod. Cliente
                { wch: 15 }, // Rev. Cliente
                { wch: 10 }, // Tipo
                { wch: 10 }, // UM
                { wch: 10 }, // Grupo
                { wch: 12 }, // Peso
                { wch: 25 }, // Operacao
                { wch: 12 }, // Com Doc
                { wch: 15 }, // Estoque
                { wch: 15 }  // Associacoes
            ];

            XLSX.utils.book_append_sheet(wb, ws, "Produtos");
            XLSX.writeFile(wb, `Catalogo_Produtos_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (err) {
            console.error('Erro ao exportar:', err);
            alert('Falha ao exportar a planilha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-[1920px] mx-auto">
                {/* Header Container */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col xl:flex-row items-center gap-4 justify-between">

                    {/* Left Group: Title */}
                    <div className="flex items-center gap-3 shrink-0 border-r border-gray-100 pr-6 mr-2">
                        <Package className="h-8 w-8 text-blue-600" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-none">
                                Catálogo de<br />Produtos
                            </h1>
                            <p className="text-[10px] text-gray-400 mt-1">Gerencie produtos e estruturas.</p>
                        </div>
                    </div>

                    {/* Right Group: Controls */}
                    <div className="flex flex-wrap items-center gap-2 w-full justify-start xl:justify-end">

                        {/* Import Button */}
                        <div className="flex gap-2">
                            <input
                                type="file"
                                id="excel-upload"
                                className="hidden"
                                accept=".xlsx, .xls"
                                onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;

                                    if (!confirm(`Deseja importar o arquivo "${file.name}" para atualizar pesos e operações?`)) {
                                        e.target.value = ''; // Reset
                                        return;
                                    }

                                    try {
                                        setLoading(true);
                                        const res = await importProductWeights(file);
                                        alert(`✅ ${res.mensagem}\n\nEstatísticas:\n- Processados: ${res.estatisticas.total_linhas}\n- Atualizados: ${res.estatisticas.atualizados}\n- Ignorados (Sem Doc): ${res.estatisticas.ignorados_sem_doc}\n- Erros: ${res.estatisticas.erros}`);
                                        fetchProducts();
                                    } catch (err) {
                                        console.error(err);
                                        alert('❌ Erro na importação: ' + (err.response?.data?.error || err.message));
                                    } finally {
                                        setLoading(false);
                                        e.target.value = ''; // Reset
                                    }
                                }}
                            />
                            <label
                                htmlFor="excel-upload"
                                className={`bg-green-600 hover:bg-green-700 text-white border border-green-600 h-10 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold uppercase tracking-wider shadow-sm shrink-0 cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Importar Pesos e Operações via Excel"
                            >
                                <Database className="h-4 w-4" />
                                <span>Importar Excel</span>
                            </label>

                            <button
                                onClick={() => setShowImportModal(true)}
                                className="bg-white border text-gray-600 hover:text-blue-600 hover:border-blue-300 h-10 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold uppercase tracking-wider shadow-sm shrink-0 mr-2"
                                title="Importação em Massa"
                            >
                                <FolderInput className="h-4 w-4" />
                                <span>Importar Docs</span>
                            </button>

                            <button
                                onClick={handleExportExcel}
                                disabled={loading}
                                className={`bg-slate-800 hover:bg-slate-900 focus:ring-slate-400 text-white border h-10 px-3 rounded-lg transition-all flex items-center gap-2 text-xs font-semibold uppercase tracking-wider shadow-sm shrink-0 mr-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Exportar resultado atual para Excel"
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Exportar XLSX</span>
                            </button>
                        </div>


                        {/* 1. Description Search (Multi-word) - PRINCIPAL */}
                        <div className="relative grow md:grow-[2] min-w-[300px]">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Descrição (ex: macho m6)..."
                                value={productFilters.search || ''}
                                onChange={e => updateProductFilters({ search: e.target.value, page: 1 })}
                                className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>

                        {/* 2. Code Filter */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Código..."
                                value={productFilters.code || ''}
                                onChange={e => updateProductFilters({ code: e.target.value, page: 1 })}
                                className="w-32 h-10 pl-3 pr-3 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>

                        {/* 3. Type Filter */}
                        <div className="relative">
                            <select
                                value={productFilters.type || ''}
                                onChange={e => updateProductFilters({ type: e.target.value, page: 1 })}
                                className="h-10 pl-3 pr-8 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white appearance-none cursor-pointer"
                            >
                                <option value="">Todos Tipos</option>
                                <option value="PA">Produto Acabado (PA)</option>
                                <option value="PI">Produto Intermediário (PI)</option>
                                <option value="MP">Matéria Prima (MP)</option>
                                <option value="MC">Material de Consumo (MC)</option>
                                <option value="BN">Beneficiamento (BN)</option>
                                <option value="EM">Embalagem (EM)</option>
                            </select>
                        </div>

                        {/* 3.1 PDF Status Filter */}
                        <div className="relative">
                            <select
                                value={productFilters.pdf_status || ''}
                                onChange={e => updateProductFilters({ pdf_status: e.target.value, page: 1 })}
                                className={`h-10 pl-3 pr-8 rounded-lg border focus:border-blue-500 outline-none text-sm appearance-none cursor-pointer font-medium transition-colors
                                    ${productFilters.pdf_status === 'with_pdf' ? 'bg-red-50 text-red-700 border-red-200' :
                                        productFilters.pdf_status === 'without_pdf' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                                            'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <option value="">Todos Docs</option>
                                <option value="with_pdf">Com PDF 📕</option>
                                <option value="without_pdf">Sem PDF ⚪</option>
                            </select>
                        </div>

                        {/* 4. File Path Filter (Multi-word) */}
                        <div className="relative grow min-w-[200px]">
                            <input
                                type="text"
                                placeholder="Endereço do arquivo..."
                                value={productFilters.file_path || ''}
                                onChange={e => updateProductFilters({ file_path: e.target.value, page: 1 })}
                                className="w-full h-10 pl-3 pr-3 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                                title="Busca multi-palavra: ex: desenhos phillips vmi"
                            />
                        </div>

                        {/* 5. Client Code Filter */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Cód. Cli..."
                                value={productFilters.client_code || ''}
                                onChange={e => updateProductFilters({ client_code: e.target.value, page: 1 })}
                                className="w-28 h-10 pl-3 pr-3 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>

                        {/* 6. Client Name Filter */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Nome Cliente..."
                                value={productFilters.client || ''}
                                onChange={e => updateProductFilters({ client: e.target.value, page: 1 })}
                                className="w-36 h-10 pl-3 pr-3 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>

                        {(productFilters.code || productFilters.search || productFilters.type || productFilters.client || productFilters.client_code || productFilters.file_path || productFilters.pdf_status) && (
                            <button
                                onClick={() => updateProductFilters({ search: '', code: '', type: '', client: '', client_code: '', file_path: '', pdf_status: '', page: 1 })}
                                className="h-10 w-10 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Limpar Filtros"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 w-16 text-center">Img</th>
                                    <th className="px-6 py-4 font-semibold">Código</th>
                                    <th className="px-6 py-4 font-semibold">Descrição</th>
                                    <th className="px-6 py-4 text-center font-semibold">Tipo</th>
                                    <th className="px-6 py-4 text-center font-semibold">UM</th>
                                    <th className="px-6 py-4 text-right font-semibold">Peso (kg)</th>
                                    <th className="px-6 py-4 font-semibold">Operação</th>
                                    <th className="px-6 py-4 font-semibold">Ref. Cliente</th>
                                    <th className="px-6 py-4 font-semibold">Associações</th>
                                    <th className="px-6 py-4 text-center font-semibold">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-12 text-center">
                                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                        </td>
                                    </tr>
                                ) : products.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-12 text-center text-gray-400">
                                            Nenhum produto encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    products.map((prod) => (
                                        <tr key={prod.codigo} className="hover:bg-gray-50 transition-colors group">
                                            {/* Image Column */}
                                            <td className="px-6 py-4 text-center">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedProductForImage(prod);
                                                    }}
                                                    className="w-12 h-12 rounded bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer hover:border-blue-400 overflow-hidden relative group/img"
                                                >
                                                    {prod.imagem_url ? (
                                                        <img src={prod.imagem_url} alt={prod.descricao || "Imagem do Produto"} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Database className="w-5 h-5 text-gray-300" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/50 hidden group-hover/img:flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">+</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono font-medium text-gray-700">
                                                {prod.codigo}
                                            </td>
                                            <td className="px-6 py-4">
                                                {prod.descricao}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-xs px-2 py-1 rounded border ${prod.tipo === 'PA' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    prod.tipo === 'MP' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        'bg-gray-50 text-gray-600 border-gray-200'
                                                    }`}>
                                                    {prod.tipo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-500">
                                                {prod.unidade}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {prod.metadados?.peso_kg && !isNaN(Number(prod.metadados.peso_kg)) ? (
                                                    <span className="font-semibold text-gray-700">
                                                        {Number(prod.metadados.peso_kg).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {prod.metadados?.operacao ? (
                                                    <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 font-medium">
                                                        {prod.metadados.operacao}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {prod.referencias && prod.referencias.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {prod.referencias.map((ref, idx) => (
                                                            <div key={idx} className="bg-yellow-50 px-2 py-1 rounded border border-yellow-100 w-fit">
                                                                <span className="font-mono font-bold text-gray-800">{ref.desenho}</span>
                                                                <span className="text-xs text-gray-500 block">{ref.cliente} {ref.revisao ? `(Rev ${ref.revisao})` : ''}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            {/* Associacoes Column */}
                                            <td className="px-6 py-4">
                                                {prod.associacoes && prod.associacoes.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {prod.associacoes.map((assoc, idx) => (
                                                            <div key={idx} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                                                <span className="font-bold">{assoc.other}</span>
                                                                <span className="text-indigo-400">({assoc.type})</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* Structure Button */}
                                                    <Link
                                                        to={`/estrutura/${encodeURIComponent(prod.codigo)}`}
                                                        state={{ from: '/produtos' }}
                                                        className={`p-2 rounded-lg transition-all ${prod.tem_estrutura
                                                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 ring-1 ring-blue-200'
                                                            : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                                            }`}
                                                        title={prod.tem_estrutura ? "Ver Estrutura" : "Sem Estrutura"}
                                                    >
                                                        <Layers className="h-4 w-4" />
                                                    </Link>

                                                    {/* Stock Button */}
                                                    <button
                                                        onClick={() => setSelectedProductForStock(prod)}
                                                        className={`p-2 rounded-lg transition-all ${prod.estoque_total > 0
                                                            ? 'text-green-600 bg-green-50 hover:bg-green-100 ring-1 ring-green-200'
                                                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                                            }`}
                                                        title={`Estoque: ${prod.estoque_total || 0}`}
                                                    >
                                                        <Database className="h-4 w-4" />
                                                    </button>

                                                    {/* Associations Button */}
                                                    <button
                                                        onClick={() => setSelectedProductForAssoc(prod)}
                                                        className={`p-2 rounded-lg transition-all ${prod.associacoes && prod.associacoes.length > 0
                                                            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200'
                                                            : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                            }`}
                                                        title={prod.associacoes && prod.associacoes.length > 0 ? `${prod.associacoes.length} Associações` : "Sem Associações"}
                                                    >
                                                        <div className="relative">
                                                            <Layers className="h-4 w-4 rotate-45" />
                                                        </div>
                                                    </button>

                                                    {/* Dropdown Wrapper */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => {
                                                                if (!prod.tem_arquivos) {
                                                                    setSelectedProduct(prod);
                                                                } else {
                                                                    // Toggle Dropdown
                                                                    setOpenMenuProductId(openMenuProductId === prod.codigo ? null : prod.codigo);
                                                                }
                                                            }}
                                                            className={`p-2 rounded-lg transition-all relative ${prod.tem_arquivos
                                                                ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200'
                                                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                                }`}
                                                            title={prod.tem_arquivos
                                                                ? "Opções de Documento"
                                                                : "Adicionar Documentos"}
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                            {prod.tem_arquivos && (
                                                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                                </span>
                                                            )}
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {openMenuProductId === prod.codigo && (
                                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-100 animate-fadeIn origin-top-right transform translate-y-8 translate-x-2">
                                                                <div className="py-1">
                                                                    {prod.primeiro_arquivo && (
                                                                        <button
                                                                            onClick={() => {
                                                                                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(prod.primeiro_arquivo)}`), '_blank');
                                                                                setOpenMenuProductId(null);
                                                                            }}
                                                                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                                        >
                                                                            <FileText className="h-4 w-4 text-red-500" />
                                                                            Abrir Desenho
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedProduct(prod);
                                                                            setOpenMenuProductId(null);
                                                                        }}
                                                                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                                                    >
                                                                        <FolderInput className="h-4 w-4 text-blue-500" />
                                                                        Gerenciar Docs
                                                                    </button>
                                                                </div>
                                                                {/* Backdrop to close */}
                                                                <div
                                                                    className="fixed inset-0 z-[-1]"
                                                                    onClick={() => setOpenMenuProductId(null)}
                                                                ></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Página <span className="font-semibold text-gray-900">{page}</span> de <span className="font-semibold text-gray-900">{totalPages}</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
                {/* Modals */}
                {selectedProductForImage && (
                    <ProductImageModal
                        product={selectedProductForImage}
                        onClose={() => setSelectedProductForImage(null)}
                        onSuccess={() => {
                            setSelectedProductForImage(null);
                            fetchProducts();
                        }}
                    />
                )}

                {selectedProductForAssoc && (
                    <ProductAssociationsModal
                        product={selectedProductForAssoc}
                        onClose={() => setSelectedProductForAssoc(null)}
                    />
                )}

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

                {showImportModal && (
                    <BulkImportModal
                        onClose={() => setShowImportModal(false)}
                        onSuccess={() => {
                            fetchProducts();
                        }}
                    />
                )}

                <StockModal
                    isOpen={!!selectedProductForStock}
                    onClose={() => setSelectedProductForStock(null)}
                    productCode={selectedProductForStock?.codigo}
                    productName={selectedProductForStock?.descricao}
                />
            </div>
        </div>
    );
};

export default ProductCatalog;
