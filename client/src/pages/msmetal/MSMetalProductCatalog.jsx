import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Search,
    Package,
    Layers,
    Database,
    FileSpreadsheet,
    X,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileText,
    Building2,
    CheckCircle2,
    AlertCircle,
    Info,
    RefreshCw
} from 'lucide-react';
import { getMSMetalProdutos } from '../../services/api';
import { useFilters } from '../../contexts/FilterContext';
import * as XLSX from 'xlsx';

const MSMetalProductCatalog = () => {
    const navigate = useNavigate();

    // Filtros persistentes compartilhados (sessionStorage + localStorage)
    const {
        msMetalProductFilters,
        updateMSMetalProductFilters,
        resetMSMetalProductFilters
    } = useFilters();

    const {
        search = '',
        code = '',
        client_code: clientCode = '',
        client_name: clientName = '',
        has_bom: hasBom = '',
        protheus_status: protheusStatus = '',
        page = 1
    } = msMetalProductFilters;

    // Estados locais de dados e UI
    const [products, setProducts] = useState([]);
    const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState(false);

    const limit = 20;

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getMSMetalProdutos({
                page,
                limit,
                search: (search || '').trim(),
                code: (code || '').trim(),
                client_code: (clientCode || '').trim(),
                client_name: (clientName || '').trim(),
                has_bom: hasBom || '',
                protheus_status: protheusStatus || ''
            });
            setProducts(res.data || []);
            setMeta(res.meta || { total: 0, totalPages: 1 });
        } catch (err) {
            console.error('Erro ao buscar produtos MS Metal:', err);
            setError(err.response?.data?.error || err.message || 'Falha ao carregar catálogo MS Metal.');
        } finally {
            setLoading(false);
        }
    }, [page, search, code, clientCode, clientName, hasBom, protheusStatus]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchProducts]);

    const handleClearFilters = () => {
        resetMSMetalProductFilters();
    };

    const hasActiveFilter = Boolean(search || code || clientCode || clientName || hasBom || protheusStatus);

    const handleExportExcel = async () => {
        try {
            setExporting(true);
            const res = await getMSMetalProdutos({
                page: 1,
                limit: 5000,
                search: (search || '').trim(),
                code: (code || '').trim(),
                client_code: (clientCode || '').trim(),
                client_name: (clientName || '').trim(),
                has_bom: hasBom || '',
                protheus_status: protheusStatus || ''
            });

            const exportData = (res.data || []).map(p => {
                const refsCli = p.REFERENCIAS_CLIENTE || [];
                const partNumbers = refsCli.map(r => r.CODIGO_CLIENTE).filter(Boolean).join(' / ');
                const nomesClientes = refsCli.map(r => r.RAZAO || r.NOME_FANT).filter(Boolean).join(' / ');
                const codDesenho = p.REFER1 || p.COD_DES_ESTRUTURA || '';

                return {
                    'Código do Desenho': codDesenho,
                    'ID MS Metal': p.PRODUTO,
                    'Descrição': p.PR_DESCR || '',
                    'Rev. Desenho MS': p.COD_REVDES_ESTRUTURA || '',
                    'UM': p.COD_UNID || '',
                    'Peso (kg)': p.PESO ? Number(p.PESO) : 0,
                    'NCM / Class. Fiscal': p.CLAS_FISC || '',
                    'Possui Estrutura (BOM)': p.ID_ESTRUTURA ? 'Sim' : 'Não',
                    'ID Estrutura MS': p.ID_ESTRUTURA || '',
                    'Vínculo Protheus': p.protheus_vinculo?.cadastrado ? `Sim (${p.protheus_vinculo.codigo} - ${p.protheus_vinculo.tipo})` : 'Não Cadastrado',
                    'Desenho Protheus (PDF)': p.desenho_origem?.tem_protheus ? 'Disponível' : 'Não',
                    'Part Number Cliente': partNumbers,
                    'Nome do Cliente': nomesClientes
                };
            });

            if (exportData.length === 0) {
                alert('Nenhum registro encontrado para exportar.');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            ws['!cols'] = [
                { wch: 22 },
                { wch: 15 },
                { wch: 45 },
                { wch: 15 },
                { wch: 8 },
                { wch: 12 },
                { wch: 15 },
                { wch: 12 },
                { wch: 14 },
                { wch: 24 },
                { wch: 16 },
                { wch: 25 },
                { wch: 35 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'MS_Metal_Produtos');
            XLSX.writeFile(wb, `Catalogo_MS_Metal_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Erro na exportação para Excel:', err);
            alert('Falha ao exportar planilha Excel.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="w-full px-2 py-2 sm:px-4 sm:py-3 space-y-3">
            
            {/* Header Superior - Widescreen Aproveitando 100% da Largura */}
            <div className="bg-white px-4 py-3.5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-xs text-white shrink-0">
                        <Database className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                                Catálogo de Produtos MS Metal
                            </h1>
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300">
                                FIREBIRD LEGADO
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Base histórica MS Metal • Consulta técnica por <strong>Código do Desenho</strong>, estruturas BOM e cruzamento Protheus.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
                    <button
                        onClick={fetchProducts}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        title="Recarregar dados"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Atualizar</span>
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={exporting || loading || products.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        title="Exportar para planilha Excel"
                    >
                        <FileSpreadsheet size={15} />
                        <span>{exporting ? 'Gerando...' : 'Exportar XLSX'}</span>
                    </button>

                    <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">Total Base</span>
                        <span className="text-xs font-black text-slate-800">
                            {meta.total ? meta.total.toLocaleString('pt-BR') : 0} itens
                        </span>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros - Largura Total com Responsividade Dinâmica */}
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                    
                    {/* 1. Código do Desenho (Destaque Principal) */}
                    <div className="sm:col-span-1 lg:col-span-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Código do Desenho (ex: MT6-7237)..."
                                value={code}
                                onChange={e => updateMSMetalProductFilters({ code: e.target.value, page: 1 })}
                                className="w-full h-9 px-3 text-xs font-mono font-bold text-blue-900 bg-blue-50/50 border border-blue-200 rounded-xl focus:bg-white focus:border-blue-600 outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* 2. Busca por Descrição Técnica */}
                    <div className="sm:col-span-1 lg:col-span-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Descrição técnica (ex: travessa, suporte)..."
                                value={search}
                                onChange={e => updateMSMetalProductFilters({ search: e.target.value, page: 1 })}
                                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* 3. Part Number Cliente */}
                    <div className="sm:col-span-1 lg:col-span-2">
                        <input
                            type="text"
                            placeholder="Part Number Cli..."
                            value={clientCode}
                            onChange={e => updateMSMetalProductFilters({ client_code: e.target.value, page: 1 })}
                            className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    {/* 4. Nome Cliente */}
                    <div className="sm:col-span-1 lg:col-span-2">
                        <input
                            type="text"
                            placeholder="Nome Cliente..."
                            value={clientName}
                            onChange={e => updateMSMetalProductFilters({ client_name: e.target.value, page: 1 })}
                            className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    {/* 5. Filtros Seletores Rápidos */}
                    <div className="sm:col-span-2 lg:col-span-2 flex gap-1.5">
                        <select
                            value={hasBom}
                            onChange={e => updateMSMetalProductFilters({ has_bom: e.target.value, page: 1 })}
                            className="flex-1 h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer font-medium text-slate-700"
                        >
                            <option value="">Todas BOM</option>
                            <option value="true">Com BOM 🌲</option>
                            <option value="false">Sem BOM ⚪</option>
                        </select>

                        <select
                            value={protheusStatus}
                            onChange={e => updateMSMetalProductFilters({ protheus_status: e.target.value, page: 1 })}
                            className="flex-1 h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer font-medium text-slate-700"
                        >
                            <option value="">Protheus</option>
                            <option value="with_protheus">No Protheus 🟢</option>
                            <option value="without_protheus">Apenas MS 🟠</option>
                        </select>

                        {hasActiveFilter && (
                            <button
                                onClick={handleClearFilters}
                                className="h-9 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                                title="Limpar todos os filtros persistentes"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                </div>
            </div>

            {/* Tabela de Produtos - Otimizada para Monitores Widescreen */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden w-full">
                <div className="overflow-x-auto min-h-[420px]">
                    <table className="w-full text-xs text-left">
                        <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/90 border-b border-slate-200 font-bold tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                            <tr>
                                <th className="px-4 py-3 min-w-[190px]">Código do Desenho</th>
                                <th className="px-4 py-3 min-w-[280px]">Descrição Técnica</th>
                                <th className="px-3 py-3 text-center w-24">Rev. MS</th>
                                <th className="px-3 py-3 text-center w-24">UM / Peso</th>
                                <th className="px-4 py-3 min-w-[190px]">Vínculo Protheus</th>
                                <th className="px-4 py-3 min-w-[190px]">Desenho / Anexo</th>
                                <th className="px-4 py-3 min-w-[240px]">Ref. Cliente / Part Number</th>
                                <th className="px-4 py-3 text-center w-28">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-24 text-center">
                                        <div className="inline-flex flex-col items-center justify-center gap-3 text-slate-400">
                                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-semibold text-xs text-slate-600">Consultando catálogo MS Metal...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-red-600">
                                        <div className="inline-flex items-center gap-2 bg-red-50 p-4 rounded-xl border border-red-200 font-medium">
                                            <AlertCircle size={18} />
                                            <span>{error}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-16 text-center text-slate-400">
                                        <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                        <p className="font-semibold text-slate-600">Nenhum produto encontrado no MS Metal com os filtros selecionados.</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Tente remover alguns filtros ou buscar por outro código de desenho.</p>
                                    </td>
                                </tr>
                            ) : (
                                products.map((prod, idx) => {
                                    const temProtheus = prod.protheus_vinculo?.cadastrado;
                                    const desOrigem = prod.desenho_origem || {};
                                    const refsCli = prod.REFERENCIAS_CLIENTE || [];
                                    const codigoDesenho = prod.REFER1 || prod.COD_DES_ESTRUTURA;

                                    return (
                                        <tr key={`${prod.PRODUTO}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                            
                                            {/* COLUNA 1: CÓDIGO DO DESENHO (DESTAQUE MÁXIMO) */}
                                            <td className="px-4 py-2.5">
                                                <div className="flex flex-col">
                                                    {codigoDesenho ? (
                                                        <span className="text-sm font-black text-blue-700 bg-blue-50/90 hover:bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200/80 w-fit font-mono tracking-tight transition-colors">
                                                            {codigoDesenho}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                                                            Sem Desenho
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        ID MS: <strong className="text-slate-600">{prod.PRODUTO}</strong>
                                                    </span>
                                                </div>
                                            </td>

                                            {/* COLUNA 2: DESCRIÇÃO TÉCNICA */}
                                            <td className="px-4 py-2.5">
                                                <div className="font-bold text-slate-900 text-xs leading-snug">
                                                    {prod.PR_DESCR}
                                                </div>
                                                {prod.CLAS_FISC && (
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        NCM: {prod.CLAS_FISC}
                                                    </span>
                                                )}
                                            </td>

                                            {/* COLUNA 3: REVISÃO MS */}
                                            <td className="px-3 py-2.5 text-center font-mono text-xs font-bold text-slate-700">
                                                {prod.COD_REVDES_ESTRUTURA ? (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        Rev {prod.COD_REVDES_ESTRUTURA}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* COLUNA 4: UM / PESO */}
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="font-bold text-slate-800 text-xs">{prod.COD_UNID || '—'}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {prod.PESO ? `${Number(prod.PESO).toFixed(2)} kg` : '0.00 kg'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* COLUNA 5: VÍNCULO PROTHEUS (SB1010) */}
                                            <td className="px-4 py-2.5">
                                                {temProtheus ? (
                                                    <Link
                                                        to={`/produtos?code=${encodeURIComponent(prod.protheus_vinculo.codigo)}`}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-2xs"
                                                        title={`Cadastrado no Protheus como: ${prod.protheus_vinculo.descricao || prod.protheus_vinculo.codigo} • Clique para ver no catálogo Protheus`}
                                                    >
                                                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                                                        <span className="font-mono">{prod.protheus_vinculo.codigo}</span>
                                                        <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1 rounded font-black">
                                                            {prod.protheus_vinculo.tipo}
                                                        </span>
                                                    </Link>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        Apenas MS Metal
                                                    </span>
                                                )}
                                            </td>

                                            {/* COLUNA 6: DESENHO / ANEXO */}
                                            <td className="px-4 py-2.5">
                                                <div className="flex flex-col gap-1">
                                                    {desOrigem.tem_protheus ? (
                                                        <a
                                                            href={desOrigem.url_protheus}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 w-fit transition-colors shadow-2xs"
                                                            title="Visualizar PDF do Desenho cadastrado no Protheus/SINCO"
                                                        >
                                                            <FileText size={11} className="text-emerald-600" />
                                                            <span>PDF Protheus ({desOrigem.qtd_docs_protheus})</span>
                                                            <ExternalLink size={9} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300">Sem PDF Protheus</span>
                                                    )}

                                                    {desOrigem.tem_ms && desOrigem.codigo_ms && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50/70 px-2 py-0.5 rounded border border-blue-200 w-fit">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                                            <span>MS: {desOrigem.codigo_ms}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* COLUNA 7: REF. CLIENTE / PART NUMBER */}
                                            <td className="px-4 py-2.5">
                                                {refsCli.length > 0 ? (
                                                    <div className="flex flex-col gap-1 max-w-[280px]">
                                                        {refsCli.slice(0, 2).map((ref, rIdx) => (
                                                            <div key={rIdx} className="bg-amber-50/90 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded text-[10px] leading-tight">
                                                                <div className="font-mono font-bold text-amber-950">
                                                                    {ref.CODIGO_CLIENTE} {ref.REVISAO ? `(Rev ${ref.REVISAO})` : ''}
                                                                </div>
                                                                <div className="text-amber-800/80 truncate text-[9px]">
                                                                    {ref.RAZAO || ref.NOME_FANT || ref.CNPJ}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {refsCli.length > 2 && (
                                                            <span className="text-[9px] text-slate-400 font-bold">
                                                                +{refsCli.length - 2} outros clientes
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* COLUNA 8: AÇÕES */}
                                            <td className="px-4 py-2.5 text-center">
                                                <button
                                                    onClick={() => {
                                                        const ident = prod.ID_ESTRUTURA || prod.REFER1 || prod.PRODUTO;
                                                        navigate(`/engenharia/msmetal/estrutura/${encodeURIComponent(ident)}`);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold ${
                                                        prod.ID_ESTRUTURA
                                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                                    }`}
                                                    title={prod.ID_ESTRUTURA ? `Ver Estrutura BOM #${prod.ID_ESTRUTURA}` : 'Consultar Ficha Técnica / BOM'}
                                                >
                                                    <Layers size={14} />
                                                    <span>{prod.ID_ESTRUTURA ? 'BOM' : 'Ficha'}</span>
                                                </button>
                                            </td>

                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação Fixa / Rodapé */}
                {!loading && meta.totalPages > 1 && (
                    <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                        <div>
                            Página <span className="font-bold text-slate-900">{page}</span> de{' '}
                            <span className="font-bold text-slate-900">{meta.totalPages}</span> ({meta.total.toLocaleString('pt-BR')} produtos cadastrados)
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => updateMSMetalProductFilters({ page: Math.max(1, page - 1) })}
                                disabled={page <= 1}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                title="Página Anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
                                {page}
                            </span>

                            <button
                                onClick={() => updateMSMetalProductFilters({ page: Math.min(meta.totalPages, page + 1) })}
                                disabled={page >= meta.totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                title="Próxima Página"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
};

export default MSMetalProductCatalog;
