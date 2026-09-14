import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Layers,
    Database,
    FileSpreadsheet,
    FileText,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Building2,
    Wrench,
    Box,
    Clock,
    Share2,
    Printer,
    RefreshCw
} from 'lucide-react';
import { getMSMetalEstrutura } from '../../services/api';
import * as XLSX from 'xlsx';

const MSMetalProductStructure = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('mp'); // 'mp' | 'sub' | 'roteiro' | 'clientes'

    const fetchEstrutura = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getMSMetalEstrutura(id);
            setData(res);
        } catch (err) {
            console.error('Erro ao carregar estrutura MS Metal:', err);
            setError(err.response?.data?.error || err.message || 'Falha ao carregar estrutura.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchEstrutura();
    }, [fetchEstrutura]);

    const handleExportExcel = () => {
        if (!data) return;

        const wb = XLSX.utils.book_new();

        // 1. Matérias-Primas
        const mpRows = (data.materias_primas || []).map(mp => ({
            'Cód. Componente': mp.COD_PRODUTO || '',
            'Ref. Desenho MP': mp.REFER_MP || '',
            'Descrição da Matéria-Prima': mp.DESC_MP || '',
            'Qtd p/ Peça': Number(mp.QTDE_PC_MP || 0),
            'Qtd em KG': Number(mp.QTDE_KG_MP || 0),
            'Unidade': mp.UN1 || '',
            'NCM': mp.NCM_MP || '',
            'Status no Protheus': mp.protheus_vinculo?.cadastrado ? `Sim (${mp.protheus_vinculo.codigo})` : 'Não'
        }));
        const wsMP = XLSX.utils.json_to_sheet(mpRows);
        XLSX.utils.book_append_sheet(wb, wsMP, 'Materias_Primas');

        // 2. Roteiro de Operações
        const rotRows = (data.roteiro || []).map(r => ({
            'Ordem': r.ORDEM_RECURSO,
            'Cód. Recurso': r.COD_RECURSO,
            'Centro de Trabalho / Máquina': r.DSC_RECURSO || '',
            'Sigla': r.SIGLA || '',
            'Tempo Preparação (min)': Number(r.TEMPO_PREP || 0),
            'Tempo Operação (min)': Number(r.TEMPO_OPER || 0)
        }));
        const wsRot = XLSX.utils.json_to_sheet(rotRows);
        XLSX.utils.book_append_sheet(wb, wsRot, 'Roteiro_Operacoes');

        // 3. Subconjuntos
        if (data.subconjuntos && data.subconjuntos.length > 0) {
            const subRows = data.subconjuntos.map(sub => ({
                'ID Estrutura': sub.ID_COMPONENTE,
                'Cód. Componente': sub.PROD_COMPONENTE || '',
                'Ref. Desenho': sub.REFER_COMPONENTE || sub.COD_DES_ESTRUTURA || '',
                'Descrição': sub.DESC_ESTRUTURA || '',
                'Qtd no Pai': Number(sub.QTD_COMPONENTE || 0)
            }));
            const wsSub = XLSX.utils.json_to_sheet(subRows);
            XLSX.utils.book_append_sheet(wb, wsSub, 'Subconjuntos');
        }

        // 4. Clientes
        if (data.clientes && data.clientes.length > 0) {
            const cliRows = data.clientes.map(c => ({
                'CNPJ': c.CNPJ,
                'Razão Social': c.RAZAO,
                'Part Number do Cliente': c.CODIGO_CLIENTE,
                'Revisão Cliente': c.REVISAO || ''
            }));
            const wsCli = XLSX.utils.json_to_sheet(cliRows);
            XLSX.utils.book_append_sheet(wb, wsCli, 'Clientes');
        }

        const fileName = `Estrutura_MSMetal_${data.produto?.REFER1 || data.produto?.PRODUTO || id}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-slate-700">Carregando árvore de estrutura do MS Metal...</p>
                <p className="text-xs text-slate-400 mt-1">Identificador: {id}</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 md:p-12">
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl border border-red-200 shadow-xs text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                    <h2 className="text-lg font-black text-slate-900">Falha ao carregar estrutura</h2>
                    <p className="text-xs text-red-600 mt-1 mb-6">{error || 'Estrutura não encontrada.'}</p>
                    <button
                        onClick={() => navigate('/engenharia/msmetal/produtos')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                    >
                        <ArrowLeft size={15} />
                        <span>Voltar ao Catálogo MS Metal</span>
                    </button>
                </div>
            </div>
        );
    }

    const { produto, estrutura, materias_primas = [], subconjuntos = [], roteiro = [], clientes = [], protheus_vinculo, desenho_origem } = data;
    const temProtheus = protheus_vinculo?.cadastrado;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-[1700px] mx-auto">
                
                {/* Breadcrumbs e Botão Voltar */}
                <div className="flex items-center justify-between gap-4 mb-4">
                    <button
                        onClick={() => navigate('/engenharia/msmetal/produtos')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs"
                    >
                        <ArrowLeft size={14} />
                        <span>Voltar ao Catálogo MS Metal</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchEstrutura}
                            className="p-2 text-slate-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                            title="Atualizar dados"
                        >
                            <RefreshCw size={15} />
                        </button>

                        <button
                            onClick={handleExportExcel}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Exportar Estrutura XLSX</span>
                        </button>
                    </div>
                </div>

                {/* Card do Cabeçalho da Estrutura */}
                <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        
                        {/* Lado Esquerdo: Produto e Estrutura */}
                        <div className="flex items-start gap-4">
                            <div className="p-3.5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-sm shrink-0">
                                <Layers className="w-8 h-8" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="font-mono text-sm font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                                        {produto.REFER1 || 'SEM REFERÊNCIA'}
                                    </span>
                                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                        MS Cód: {produto.PRODUTO}
                                    </span>
                                    {estrutura?.ID_ESTRUTURA && (
                                        <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                                            BOM #{estrutura.ID_ESTRUTURA}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                    {produto.PR_DESCR || estrutura?.DESC_ESTRUTURA || 'Produto Sem Descrição'}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 font-medium">
                                    <span>Unidade: <strong className="text-slate-800 font-bold">{produto.COD_UNID || '—'}</strong></span>
                                    <span>•</span>
                                    <span>Peso: <strong className="text-slate-800 font-bold">{produto.PESO ? `${Number(produto.PESO).toFixed(3)} kg` : '0.000 kg'}</strong></span>
                                    {produto.CLAS_FISC && (
                                        <>
                                            <span>•</span>
                                            <span>NCM: <strong className="text-slate-800 font-mono">{produto.CLAS_FISC}</strong></span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Lado Direito: Comparativo Protheus & Origem Desenhos */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            
                            {/* Card Vínculo Protheus */}
                            <div className={`p-4 rounded-2xl border text-xs flex flex-col justify-center min-w-[240px] ${
                                temProtheus
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                            }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {temProtheus ? (
                                        <>
                                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                            <span className="font-black text-emerald-900">VINCULADO AO PROTHEUS</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                            <span className="font-black text-amber-900">APENAS NO MS METAL</span>
                                        </>
                                    )}
                                </div>
                                {temProtheus ? (
                                    <div className="mt-1">
                                        <div className="font-mono font-bold text-slate-900 text-sm">
                                            {protheus_vinculo.codigo} <span className="text-xs text-emerald-700">({protheus_vinculo.tipo})</span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 truncate max-w-[220px]">
                                            {protheus_vinculo.descricao}
                                        </div>
                                        <Link
                                            to={`/estrutura/${encodeURIComponent(protheus_vinculo.codigo)}`}
                                            className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 hover:text-blue-900 mt-2 transition-colors underline"
                                        >
                                            <span>Ver Estrutura no Protheus</span>
                                            <ExternalLink size={10} />
                                        </Link>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                                        Item não localizado na tabela SB1010 do ERP Protheus.
                                    </p>
                                )}
                            </div>

                            {/* Card Desenho / Documentos */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex flex-col justify-center min-w-[220px]">
                                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">
                                    Origem dos Desenhos
                                </span>
                                
                                {desenho_origem?.tem_ms && (
                                    <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium mb-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                        <span>MS: <strong className="font-mono">{desenho_origem.codigo_ms}</strong> {desenho_origem.revisao_ms ? `(Rev ${desenho_origem.revisao_ms})` : ''}</span>
                                    </div>
                                )}

                                {desenho_origem?.tem_protheus ? (
                                    <a
                                        href={desenho_origem.url_protheus}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 mt-1 bg-emerald-100/60 px-2.5 py-1 rounded-lg border border-emerald-300 w-fit transition-all"
                                    >
                                        <FileText size={13} className="text-emerald-600" />
                                        <span>PDF Protheus / SINCO</span>
                                        <ExternalLink size={10} />
                                    </a>
                                ) : (
                                    <span className="text-[11px] text-slate-400 mt-1">
                                        Nenhum PDF no Protheus
                                    </span>
                                )}
                            </div>

                        </div>
                    </div>
                </div>

                {/* Navegação por Abas */}
                <div className="flex items-center gap-2 mb-4 bg-slate-200/60 p-1.5 rounded-2xl w-fit border border-slate-300/80">
                    <button
                        onClick={() => setActiveTab('mp')}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'mp'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Box size={15} className={activeTab === 'mp' ? 'text-blue-600' : 'text-slate-400'} />
                        <span>Matérias-Primas ({materias_primas.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('roteiro')}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                            activeTab === 'roteiro'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Clock size={15} className={activeTab === 'roteiro' ? 'text-amber-600' : 'text-slate-400'} />
                        <span>Roteiro de Operações ({roteiro.length})</span>
                    </button>

                    {subconjuntos.length > 0 && (
                        <button
                            onClick={() => setActiveTab('sub')}
                            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'sub'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers size={15} className={activeTab === 'sub' ? 'text-indigo-600' : 'text-slate-400'} />
                            <span>Subconjuntos ({subconjuntos.length})</span>
                        </button>
                    )}

                    {clientes.length > 0 && (
                        <button
                            onClick={() => setActiveTab('clientes')}
                            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'clientes'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Building2 size={15} className={activeTab === 'clientes' ? 'text-emerald-600' : 'text-slate-400'} />
                            <span>Vínculos de Clientes ({clientes.length})</span>
                        </button>
                    )}
                </div>

                {/* Conteúdo das Abas */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                    
                    {/* ABA 1: MATÉRIAS-PRIMAS */}
                    {activeTab === 'mp' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3.5">Cód. Componente</th>
                                        <th className="px-5 py-3.5">Ref. Desenho MP</th>
                                        <th className="px-5 py-3.5 min-w-[280px]">Descrição da Matéria-Prima</th>
                                        <th className="px-4 py-3.5 text-right font-semibold">Qtd p/ Peça</th>
                                        <th className="px-4 py-3.5 text-right font-semibold">Qtd em KG</th>
                                        <th className="px-4 py-3.5 text-center font-semibold">Unidade</th>
                                        <th className="px-5 py-3.5">NCM</th>
                                        <th className="px-5 py-3.5">Protheus</th>
                                        <th className="px-5 py-3.5 text-center">Desenho</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {materias_primas.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center text-slate-400 font-medium">
                                                Nenhuma matéria-prima cadastrada nesta estrutura no MS Metal.
                                            </td>
                                        </tr>
                                    ) : (
                                        materias_primas.map((mp, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-5 py-3 font-mono font-bold text-slate-700">
                                                    {mp.COD_PRODUTO}
                                                </td>
                                                <td className="px-5 py-3 font-mono font-bold text-blue-700">
                                                    {mp.REFER_MP ? (
                                                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                            {mp.REFER_MP}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 font-semibold text-slate-800">
                                                    {mp.DESC_MP}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                                    {mp.QTDE_PC_MP ? Number(mp.QTDE_PC_MP).toFixed(3) : '0.000'}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                    {mp.QTDE_KG_MP ? Number(mp.QTDE_KG_MP).toFixed(3) : '0.000'}
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-600">
                                                    {mp.UN1 || 'PC'}
                                                </td>
                                                <td className="px-5 py-3 font-mono text-slate-500 text-[11px]">
                                                    {mp.NCM_MP || '—'}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {mp.protheus_vinculo?.cadastrado ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                            <span>{mp.protheus_vinculo.codigo}</span>
                                                            <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded">
                                                                {mp.protheus_vinculo.tipo}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">Não cadastrado</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-center">
                                                    {mp.desenho_protheus ? (
                                                        <a
                                                            href={mp.desenho_protheus}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                                        >
                                                            <FileText size={11} />
                                                            <span>PDF</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ABA 2: ROTEIRO DE OPERAÇÕES */}
                    {activeTab === 'roteiro' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3.5 w-16 text-center">Ordem</th>
                                        <th className="px-5 py-3.5">Cód. Recurso</th>
                                        <th className="px-5 py-3.5 min-w-[260px]">Centro de Trabalho / Máquina</th>
                                        <th className="px-5 py-3.5">Sigla</th>
                                        <th className="px-5 py-3.5 text-right font-semibold">Tempo Prep. (min)</th>
                                        <th className="px-5 py-3.5 text-right font-semibold">Tempo Oper. (min)</th>
                                        <th className="px-5 py-3.5 text-right font-semibold">Tempo Total (min)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {roteiro.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-medium">
                                                Nenhuma operação cadastrada no roteiro desta estrutura.
                                            </td>
                                        </tr>
                                    ) : (
                                        roteiro.map((rot, idx) => {
                                            const prep = Number(rot.TEMPO_PREP || 0);
                                            const oper = Number(rot.TEMPO_OPER || 0);
                                            const total = prep + oper;

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-5 py-3 text-center font-black text-slate-800">
                                                        <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 inline-flex items-center justify-center text-xs">
                                                            {rot.ORDEM_RECURSO}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 font-mono font-bold text-slate-700">
                                                        {rot.COD_RECURSO}
                                                    </td>
                                                    <td className="px-5 py-3 font-semibold text-slate-900">
                                                        {rot.DSC_RECURSO || 'Recurso Sem Descrição'}
                                                    </td>
                                                    <td className="px-5 py-3 font-mono text-slate-500 font-bold">
                                                        {rot.SIGLA || '—'}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-mono text-slate-700">
                                                        {prep.toFixed(2)}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-mono font-bold text-blue-700">
                                                        {oper.toFixed(2)}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-mono font-black text-slate-900">
                                                        {total.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ABA 3: SUBCONJUNTOS */}
                    {activeTab === 'sub' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3.5">ID Estrutura Filha</th>
                                        <th className="px-5 py-3.5">Ref. Desenho</th>
                                        <th className="px-5 py-3.5">Cód. Produto</th>
                                        <th className="px-5 py-3.5 min-w-[240px]">Descrição do Subconjunto</th>
                                        <th className="px-5 py-3.5 text-right font-semibold">Qtd no Conjunto Pai</th>
                                        <th className="px-5 py-3.5 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {subconjuntos.map((sub, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-5 py-3 font-mono font-bold text-indigo-700">
                                                #{sub.ID_COMPONENTE}
                                            </td>
                                            <td className="px-5 py-3 font-mono font-bold text-blue-700">
                                                {sub.REFER_COMPONENTE || sub.COD_DES_ESTRUTURA || '—'}
                                            </td>
                                            <td className="px-5 py-3 font-mono text-slate-700">
                                                {sub.PROD_COMPONENTE || '—'}
                                            </td>
                                            <td className="px-5 py-3 font-semibold text-slate-800">
                                                {sub.DESC_ESTRUTURA || 'Subconjunto'}
                                            </td>
                                            <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                                                {Number(sub.QTD_COMPONENTE || 0).toFixed(2)}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    onClick={() => navigate(`/engenharia/msmetal/estrutura/${sub.ID_COMPONENTE}`)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                                >
                                                    <Layers size={13} />
                                                    <span>Explodir</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ABA 4: CLIENTES */}
                    {activeTab === 'clientes' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3.5">CNPJ</th>
                                        <th className="px-5 py-3.5 min-w-[260px]">Razão Social</th>
                                        <th className="px-5 py-3.5">Nome Fantasia</th>
                                        <th className="px-5 py-3.5 font-semibold">Part Number do Cliente</th>
                                        <th className="px-5 py-3.5 text-center font-semibold">Revisão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {clientes.map((cli, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-5 py-3 font-mono text-slate-600">
                                                {cli.CNPJ}
                                            </td>
                                            <td className="px-5 py-3 font-bold text-slate-800">
                                                {cli.RAZAO || '—'}
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">
                                                {cli.NOME_FANT || '—'}
                                            </td>
                                            <td className="px-5 py-3 font-mono font-black text-amber-900 bg-amber-50/50">
                                                {cli.CODIGO_CLIENTE}
                                            </td>
                                            <td className="px-5 py-3 text-center font-mono font-bold text-slate-700">
                                                {cli.REVISAO || '00'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
};

export default MSMetalProductStructure;
