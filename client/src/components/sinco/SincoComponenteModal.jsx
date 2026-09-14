import React, { useState, useEffect, useCallback } from 'react';
import {
    X,
    FileText,
    Wrench,
    Building2,
    AlertTriangle,
    Layers,
    Package,
    ExternalLink,
    Sparkles,
    Edit3,
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    FolderOpen,
    Clock,
    Tag,
    Hash
} from 'lucide-react';
import api, {
    getSincoProduto,
    getSincoOperacoes,
    getSincoRestricoes,
    getSincoRestricoesSz0,
    getSincoArvore,
    getProductDocuments
} from '../../services/api';

export default function SincoComponenteModal({
    isOpen,
    onClose,
    codigo,
    descricao,
    nivel = 0,
    quantidade = 1,
    unidade = 'UN',
    onCarregarNoFormulario,
    onCadastrarProtheus
}) {
    const [activeTab, setActiveTab] = useState('geral'); // 'geral' | 'docs' | 'roteiro' | 'sz1' | 'sz0' | 'subarvore'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Dados por aba
    const [dadosGerais, setDadosGerais] = useState(null);
    const [docs, setDocs] = useState([]);
    const [roteiro, setRoteiro] = useState([]);
    const [restricoesSz1, setRestricoesSz1] = useState([]);
    const [restricoesSz0, setRestricoesSz0] = useState([]);
    const [subarvore, setSubarvore] = useState([]);

    const cleanCodigo = (codigo || '').replace(/\.[^/.]+$/, '').trim().toUpperCase();

    const carregarTudo = useCallback(async () => {
        if (!cleanCodigo) return;
        setLoading(true);
        setError(null);
        try {
            // Executa requisições em paralelo com tratamento tolerante a falhas individuais
            const [prodRes, docsRes, opeRes, sz1Res, sz0Res, arvRes] = await Promise.allSettled([
                getSincoProduto(cleanCodigo),
                getProductDocuments(cleanCodigo),
                getSincoOperacoes(cleanCodigo),
                getSincoRestricoes(cleanCodigo),
                getSincoRestricoesSz0(cleanCodigo),
                getSincoArvore(cleanCodigo)
            ]);

            if (prodRes.status === 'fulfilled' && prodRes.value) {
                setDadosGerais(prodRes.value);
            } else {
                setDadosGerais(null);
            }

            if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)) {
                setDocs(docsRes.value);
            } else {
                setDocs([]);
            }

            if (opeRes.status === 'fulfilled' && Array.isArray(opeRes.value)) {
                setRoteiro(opeRes.value);
            } else {
                setRoteiro([]);
            }

            if (sz1Res.status === 'fulfilled' && Array.isArray(sz1Res.value)) {
                setRestricoesSz1(sz1Res.value);
            } else {
                setRestricoesSz1([]);
            }

            if (sz0Res.status === 'fulfilled' && Array.isArray(sz0Res.value)) {
                setRestricoesSz0(sz0Res.value);
            } else {
                setRestricoesSz0([]);
            }

            if (arvRes.status === 'fulfilled' && Array.isArray(arvRes.value)) {
                setSubarvore(arvRes.value);
            } else {
                setSubarvore([]);
            }

        } catch (err) {
            console.error('Erro ao inspecionar nó do produto:', err);
            setError(err.message || 'Falha ao carregar dados do componente.');
        } finally {
            setLoading(false);
        }
    }, [cleanCodigo]);

    useEffect(() => {
        if (isOpen && cleanCodigo) {
            carregarTudo();
        } else {
            setDadosGerais(null);
            setDocs([]);
            setRoteiro([]);
            setRestricoesSz1([]);
            setRestricoesSz0([]);
            setSubarvore([]);
            setError(null);
            setActiveTab('geral');
        }
    }, [isOpen, cleanCodigo, carregarTudo]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
                
                {/* Cabeçalho do Modal */}
                <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-start justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-500/40 text-blue-400">
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-base font-black text-white tracking-wide">
                                    {cleanCodigo}
                                </span>
                                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-400/30">
                                    Nível {nivel}
                                </span>
                                {dadosGerais?.tipo && (
                                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-400/30">
                                        Tipo: {dadosGerais.tipo}
                                    </span>
                                )}
                                {dadosGerais?.grupo && (
                                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-400/30">
                                        Grupo: {dadosGerais.grupo}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl truncate" title={descricao || dadosGerais?.titulo}>
                                {descricao || dadosGerais?.titulo || 'Sem descrição cadastrada'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={carregarTudo}
                            disabled={loading}
                            title="Recarregar Dados"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer"
                            title="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Barra de Abas da Inspeção */}
                <div className="px-5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
                    <div className="flex items-center gap-1.5 py-2">
                        <button
                            onClick={() => setActiveTab('geral')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'geral'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <Package size={14} className="text-blue-600" />
                            <span>Dados Gerais</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('docs')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'docs'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <FileText size={14} className="text-red-600" />
                            <span>Desenhos PDF ({docs.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('roteiro')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'roteiro'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <Wrench size={14} className="text-amber-600" />
                            <span>Roteiro / Operações ({roteiro.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('sz1')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'sz1'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <Building2 size={14} className="text-emerald-600" />
                            <span>Clientes (SZ1) ({restricoesSz1.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('sz0')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'sz0'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <AlertTriangle size={14} className="text-orange-600" />
                            <span>Restrições (SZ0) ({restricoesSz0.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('subarvore')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'subarvore'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                            }`}
                        >
                            <Layers size={14} className="text-indigo-600" />
                            <span>Sub-árvore BOM ({subarvore.length})</span>
                        </button>
                    </div>

                    {/* Ação Rápida de Carregar no Formulário Principal */}
                    <div className="flex items-center gap-2 shrink-0 py-2">
                        {onCarregarNoFormulario && (
                            <button
                                onClick={() => {
                                    onCarregarNoFormulario(cleanCodigo);
                                    onClose();
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Carregar este componente como item ativo no formulário"
                            >
                                <Edit3 size={13} />
                                <span>Carregar no Formulário</span>
                            </button>
                        )}
                        {onCadastrarProtheus && (
                            <button
                                onClick={() => {
                                    onCadastrarProtheus({
                                        b1_xcode: cleanCodigo,
                                        b1_xcoddes: cleanCodigo,
                                        titulo: descricao || dadosGerais?.titulo || '',
                                        uom: unidade || dadosGerais?.unidade || 'PC',
                                        tipo: dadosGerais?.tipo || 'PI',
                                        peso: dadosGerais?.peso || ''
                                    });
                                    onClose();
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Cadastrar ou revisar este componente no Protheus"
                            >
                                <Sparkles size={13} />
                                <span>Cadastrar no Protheus</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Conteúdo Dinâmico das Abas */}
                <div className="p-5 flex-1 overflow-y-auto min-h-[380px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                            <span className="text-xs font-semibold">Consultando Protheus e engenharia...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : (
                        <>
                            {/* ABA 1: DADOS GERAIS */}
                            {activeTab === 'geral' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Tipo do Produto</span>
                                            <span className="text-sm font-black text-slate-800">{dadosGerais?.tipo || '—'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Unidade de Medida</span>
                                            <span className="text-sm font-black text-slate-800">{dadosGerais?.unidade || unidade || '—'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Grupo</span>
                                            <span className="text-sm font-black text-slate-800">{dadosGerais?.grupo || '—'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Peso Unitário (kg)</span>
                                            <span className="text-sm font-black text-slate-800">
                                                {dadosGerais?.peso ? `${Number(dadosGerais.peso).toFixed(3)} kg` : '0.000 kg'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Dimensões & Matéria-Prima
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <span className="text-slate-400 text-[10px] block">Espessura (mm)</span>
                                                <strong className="text-slate-800 font-mono">{dadosGerais?.espessura || '—'}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block">Largura (mm)</span>
                                                <strong className="text-slate-800 font-mono">{dadosGerais?.largura || '—'}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block">Comprimento (mm)</span>
                                                <strong className="text-slate-800 font-mono">{dadosGerais?.comprimento || '—'}</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] block">Área (m²)</span>
                                                <strong className="text-slate-800 font-mono">{dadosGerais?.area || '—'}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {dadosGerais?.acabamento && (
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Acabamento / Observações</span>
                                            <p className="text-slate-700 mt-1 font-medium">{dadosGerais.acabamento}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 2: DESENHOS E DOCUMENTOS */}
                            {activeTab === 'docs' && (
                                <div className="space-y-3">
                                    {docs.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs">
                                            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                            Nenhum documento ou desenho técnico anexado a este componente.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {docs.map((doc, dIdx) => {
                                                const url = doc.caminho_relativo 
                                                    ? `/api/docs/view?path=${encodeURIComponent(doc.caminho_relativo)}`
                                                    : (doc.url || '#');
                                                const isPdf = (doc.nome_arquivo || doc.caminho_relativo || '').toLowerCase().endsWith('.pdf');

                                                return (
                                                    <div key={dIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100 transition-colors">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                                                                <FileText size={16} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="text-xs font-bold text-slate-800 block truncate" title={doc.nome_arquivo || doc.descricao}>
                                                                    {doc.nome_arquivo || doc.descricao || 'Desenho Técnico'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 block font-mono">
                                                                    {doc.tipo || (isPdf ? 'PDF' : 'Anexo')}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                                                        >
                                                            <span>Visualizar</span>
                                                            <ExternalLink size={12} />
                                                        </a>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 3: ROTEIRO E OPERAÇÕES */}
                            {activeTab === 'roteiro' && (
                                <div>
                                    {roteiro.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs">
                                            <Wrench className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                            Nenhum roteiro de operações cadastrado no Protheus (SG2) para este item.
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                                                    <tr>
                                                        <th className="px-3 py-2 text-center w-14">Seq.</th>
                                                        <th className="px-3 py-2 w-28">Operação</th>
                                                        <th className="px-3 py-2">Recurso / Centro Trabalho</th>
                                                        <th className="px-3 py-2 text-center w-24">Tempo Pad.</th>
                                                        <th className="px-3 py-2">Descrição</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {roteiro.map((op, oIdx) => (
                                                        <tr key={oIdx} className="hover:bg-slate-50/70">
                                                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-600">
                                                                {op.G2_OPERAC || op.operacao || oIdx + 1}
                                                            </td>
                                                            <td className="px-3 py-2 font-bold text-slate-800">
                                                                {op.G2_CODIGO || op.codigo || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono text-slate-700">
                                                                {op.G2_RECURSO || op.recurso || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-mono text-slate-700">
                                                                {op.G2_TEMPO !== undefined ? `${Number(op.G2_TEMPO).toFixed(2)} min` : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-600">
                                                                {op.G2_DESC || op.descricao || '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 4: CLIENTES E PART NUMBERS (SZ1) */}
                            {activeTab === 'sz1' && (
                                <div>
                                    {restricoesSz1.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs">
                                            <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                            Nenhum vínculo de produto x cliente (SZ1) cadastrado no Protheus.
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                                                    <tr>
                                                        <th className="px-3 py-2">Cliente / Razão Social</th>
                                                        <th className="px-3 py-2">Código do Cliente (Part Number)</th>
                                                        <th className="px-3 py-2 text-center w-20">Rev. Cli</th>
                                                        <th className="px-3 py-2 text-center w-20">Loja</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {restricoesSz1.map((sz, sIdx) => (
                                                        <tr key={sIdx} className="hover:bg-slate-50/70">
                                                            <td className="px-3 py-2 font-bold text-slate-800">
                                                                {sz.Z1_NOMCLI || sz.nome_cliente || sz.cliente || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono font-bold text-blue-700 bg-blue-50/50">
                                                                {sz.Z1_CODCLI || sz.codigo_cliente || sz.desenho || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-700">
                                                                {sz.Z1_REVCLI || sz.revisao || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-mono text-slate-500">
                                                                {sz.Z1_LOJA || sz.loja || '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 5: RESTRIÇÕES DE PROCESSO (SZ0) */}
                            {activeTab === 'sz0' && (
                                <div>
                                    {restricoesSz0.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs">
                                            <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                            Nenhuma restrição de engenharia/processo (SZ0) cadastrada para este item.
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {restricoesSz0.map((r, rIdx) => (
                                                <div key={rIdx} className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <strong className="text-amber-950 font-bold">
                                                            {r.Z0_RESUMO || r.resumo || 'Restrição Técnica'}
                                                        </strong>
                                                        <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-bold">
                                                            Status: {r.Z0_STATUS || r.status || 'Pendente'}
                                                        </span>
                                                    </div>
                                                    <p className="text-amber-900 leading-relaxed font-medium">
                                                        {r.Z0_RESTRIC || r.restricao || '—'}
                                                    </p>
                                                    <div className="text-[10px] text-amber-800/80 pt-1 flex items-center gap-3">
                                                        <span>Responsável: <strong>{r.Z0_RESPONS || r.responsavel || '—'}</strong></span>
                                                        <span>Rev: <strong>{r.Z0_REVMETA || r.revMetalfisa || '—'}</strong></span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 6: SUB-ÁRVORE (BOM) */}
                            {activeTab === 'subarvore' && (
                                <div>
                                    {subarvore.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs">
                                            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                                            Este item não possui subcomponentes ou matérias-primas na BOM (Item folha ou comprado).
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px]">
                                                    <tr>
                                                        <th className="px-3 py-2 text-center w-12">Nív.</th>
                                                        <th className="px-3 py-2">Código Componente</th>
                                                        <th className="px-3 py-2">Descrição</th>
                                                        <th className="px-3 py-2 text-right w-20">Qtde</th>
                                                        <th className="px-3 py-2 text-center w-12">UN</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {subarvore.map((sub, sIdx) => (
                                                        <tr key={sIdx} className="hover:bg-slate-50/70">
                                                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-500">
                                                                {sub.Nivel !== undefined ? sub.Nivel : (sub.nivel || 1)}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                                {sub.B1_COD || sub.componente || sub.codigo || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-slate-700">
                                                                {sub.B1_DESC || sub.descricao || '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                                                                {Number(sub.QUANTIDADE || sub.quantidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-bold text-slate-600">
                                                                {sub.B1_UM || sub.unidade || sub.um || 'UN'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                        </>
                    )}
                </div>

                {/* Rodapé */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
                    <div>
                        Código ativo: <strong className="text-slate-900 font-mono">{cleanCodigo}</strong>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>

            </div>
        </div>
    );
}
