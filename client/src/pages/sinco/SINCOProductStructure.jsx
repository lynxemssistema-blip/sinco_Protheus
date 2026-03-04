import React, { useState } from 'react';
import { FileText, MessageSquare, XCircle, Search, Package, Network, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSincoProductStructure, getSincoComentariosEngenharia, createSincoComentarioEngenharia, updateSincoComentarioEngenhariaStatus } from '../../services/api';

const openDoc = (filePath) => {
    if (!filePath) return;
    window.open(`/api/docs/view?path=${encodeURIComponent(filePath)}`, '_blank', 'noopener,noreferrer');
};

// Badge colorido baseado no txtTipoDesenho
const TIPO_BADGE = {
    'CONJUNTO DE MONTAGEM': 'bg-blue-100 text-blue-700',
    'CONJUNTO DE SOLDA':    'bg-indigo-100 text-indigo-700',
    'CHAPARIA':             'bg-amber-100 text-amber-700',
    'MATERIAL':             'bg-slate-100 text-slate-600',
    'PINTADO':              'bg-green-100 text-green-700',
    'NA':                   'bg-gray-100 text-gray-500',
    'NO CONJUNTO':          'bg-gray-100 text-gray-500',
};

function TipoBadge({ tipo }) {
    if (!tipo) return null;
    const cls = TIPO_BADGE[tipo.toUpperCase()] || 'bg-slate-100 text-slate-500';
    return (
        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${cls} whitespace-nowrap`}>
            {tipo}
        </span>
    );
}

// Formata número pt-BR com até 4 casas
const fmtQtd = (v) =>
    parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const SINCOProductStructure = () => {
    const { user } = useAuth();

    const [searchTerm, setSearchTerm]   = useState('');
    const [isLoading, setIsLoading]     = useState(false);
    const [structure, setStructure]     = useState(null);
    const [error, setError]             = useState('');
    const [expandedRows, setExpandedRows] = useState({});

    // Comments panel
    const [isCommentsOpen, setIsCommentsOpen]     = useState(false);
    const [commentsItem, setCommentsItem]         = useState(null);
    const [comments, setComments]                 = useState([]);
    const [isFetchingComments, setIsFetchingComments] = useState(false);
    const [newComment, setNewComment]             = useState('');
    const [resolvingId, setResolvingId]           = useState(null);
    const [resolveStatus, setResolveStatus]       = useState('FEITO');
    const [resolveObservation, setResolveObservation] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        setError('');
        if (!searchTerm.trim()) return;
        setIsLoading(true);
        try {
            const result = await getSincoProductStructure(searchTerm);
            if (result?.tree) {
                const initial = {};
                result.tree.forEach(item => { initial[item.CodMatFabricante] = true; });
                setExpandedRows(initial);
            }
            setStructure(result);
        } catch (err) {
            setError(err.message || 'Erro ao carregar estrutura.');
            setStructure(null);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (item) => {
        setExpandedRows(prev => ({ ...prev, [item.CodMatFabricante]: !prev[item.CodMatFabricante] }));
    };

    const openComments = async (item) => {
        setCommentsItem(item);
        setIsCommentsOpen(true);
        await fetchComments(item.CodMatFabricante);
    };

    const fetchComments = async (codigo) => {
        setIsFetchingComments(true);
        try {
            const data = await getSincoComentariosEngenharia(codigo);
            setComments(data);
        } catch (err) {
            console.error('Failed to fetch comments', err);
        } finally {
            setIsFetchingComments(false);
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            await createSincoComentarioEngenharia(commentsItem.CodMatFabricante, {
                ProdutoPai: structure?.rootCode || '',
                Nivel: commentsItem.nivel || 0,
                UsuarioCriacao: user?.nome || user?.username || 'Usuário',
                Comentario: newComment
            });
            setNewComment('');
            fetchComments(commentsItem.CodMatFabricante);
        } catch {
            alert('Erro ao enviar comentário.');
        }
    };

    const handleResolveComment = async (e, id) => {
        e.preventDefault();
        try {
            await updateSincoComentarioEngenhariaStatus(id, {
                Status: resolveStatus,
                ObservacaoProjetista: resolveObservation,
                UsuarioResolucao: user?.nome || user?.username || 'Projeto'
            });
            setResolvingId(null);
            setResolveObservation('');
            setResolveStatus('FEITO');
            fetchComments(commentsItem.CodMatFabricante);
        } catch {
            alert('Erro ao resolver comentário.');
        }
    };

    // Build visible rows respecting collapse
    const buildVisibleRows = (tree) => {
        const rows = [];
        let hideBelow = -1;
        for (let i = 0; i < tree.length; i++) {
            const item = tree[i];
            if (hideBelow !== -1) {
                if (item.nivel <= hideBelow) hideBelow = -1;
                else continue;
            }
            const isExpanded = expandedRows[item.CodMatFabricante];
            const hasStructChildren = i + 1 < tree.length && tree[i + 1].nivel > item.nivel;
            const hasMatsOrProcs = (item.materiais?.length > 0 || item.processos?.length > 0);
            const hasChildren = hasStructChildren || hasMatsOrProcs;
            if (!isExpanded && hasStructChildren) hideBelow = item.nivel;
            rows.push({ item, idx: i, isExpanded, hasChildren });
        }
        return rows;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">

            {/* Header & Search */}
            <div className="bg-white border-b p-4 md:p-6 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Network className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Estrutura do Produto (SINCO)</h1>
                            <p className="text-sm text-slate-500">Verifique a árvore de montagem, materiais e processos.</p>
                        </div>
                    </div>
                    <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-96">
                        <input
                            type="text"
                            placeholder="Buscar código (ex: MT...)"
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !searchTerm.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg flex items-center font-medium transition-colors disabled:opacity-50"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            Buscar
                        </button>
                    </form>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6 max-w-7xl mx-auto w-full">

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-center gap-2">
                        <XCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                {!structure && !isLoading && !error && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Package className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Digite um código para buscar a estrutura.</p>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                )}

                {structure && (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">

                        {/* Card header */}
                        <div className="p-5 flex justify-between items-center border-b bg-white">
                            <div className="flex items-center gap-3">
                                <Layers className="w-6 h-6 text-blue-600" />
                                <div>
                                    <h2 className="text-xl font-bold font-mono text-slate-800">{structure.rootCode}</h2>
                                    <p className="text-sm text-slate-500">Árvore de Estrutura</p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-center">
                                <span className="bg-slate-100 text-slate-600 font-bold px-4 py-1.5 rounded-lg text-sm">
                                    {structure.tree.length} Itens
                                </span>
                                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Gerar Lista de Materiais (BOM)
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b sticky top-0 z-10">
                                        <th className="px-4 py-3 w-14 text-center">Nível</th>
                                        <th className="px-4 py-3 min-w-[220px]">Produto</th>
                                        <th className="px-4 py-3 min-w-[200px]">Descrição</th>
                                        <th className="px-4 py-3 w-28 text-center">Observação</th>
                                        <th className="px-4 py-3 w-28 text-right">Qtde Unit.</th>
                                        <th className="px-4 py-3 w-28 text-right">Qtde Total</th>
                                        <th className="px-4 py-3 w-20 text-center">Unidade</th>
                                        <th className="px-4 py-3 w-20 text-center">PDF</th>
                                        <th className="px-4 py-3 w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {buildVisibleRows(structure.tree).map(({ item, idx, isExpanded, hasChildren }) => {
                                        const hasPdf    = item.hasPdfFile;
                                        const pdfPath   = item.pdfPath;
                                        const hasWarning = structure.unresolvedComments?.includes(item.CodMatFabricante);
                                        const indentPx  = item.nivel === 0 ? 0 : (item.nivel - 1) * 20;

                                        return (
                                            <React.Fragment key={idx}>
                                                <tr className={`border-b transition-colors group ${hasWarning ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}>

                                                    {/* NÍVEL */}
                                                    <td className="px-4 py-3 text-center relative">
                                                        {hasWarning && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" title="Pendências de revisão" />
                                                        )}
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                                            ${item.nivel === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {item.nivel}
                                                        </span>
                                                    </td>

                                                    {/* PRODUTO */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-start gap-1" style={{ paddingLeft: `${indentPx}px` }}>
                                                            {item.nivel > 0 && (
                                                                <span className="text-slate-300 font-mono text-xs mt-0.5 shrink-0 select-none">└─</span>
                                                            )}
                                                            <div className="flex flex-col gap-1 min-w-0">
                                                                <span className={`font-mono font-bold text-xs leading-tight break-all
                                                                    ${item.nivel === 0 ? 'text-blue-700' : (hasWarning ? 'text-amber-700' : 'text-slate-700')}`}>
                                                                    {item.CodMatFabricante}
                                                                    {hasWarning && (
                                                                        <span className="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full ml-1.5 animate-pulse align-middle" title="Revisão pendente" />
                                                                    )}
                                                                </span>
                                                                {item.txtTipoDesenho && (
                                                                    <TipoBadge tipo={item.txtTipoDesenho} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* DESCRIÇÃO */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-slate-800 text-xs font-medium leading-snug">
                                                                {item.DescResumo || '—'}
                                                            </span>
                                                            {item.MaterialSW && (
                                                                <span className="text-[10px] text-slate-400">{item.MaterialSW}</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* OBSERVAÇÃO */}
                                                    <td className="px-4 py-3 text-center text-xs text-slate-400">-</td>

                                                    {/* QTDE UNIT. */}
                                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                                        {fmtQtd(item.QtdeTotal)}
                                                    </td>

                                                    {/* QTDE TOTAL */}
                                                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-800">
                                                        {fmtQtd(item.QtdeTotal)}
                                                    </td>

                                                    {/* UNIDADE */}
                                                    <td className="px-4 py-3 text-center text-xs text-slate-500 uppercase">
                                                        {item.Unidade || '—'}
                                                    </td>

                                                    {/* PDF */}
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => hasPdf && openDoc(pdfPath)}
                                                            disabled={!hasPdf}
                                                            title={hasPdf ? 'Abrir PDF' : 'Sem PDF disponível'}
                                                            className={`p-1.5 rounded transition-colors ${hasPdf ? 'hover:bg-red-50 cursor-pointer text-red-500' : 'cursor-not-allowed text-slate-200'}`}
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    </td>

                                                    {/* AÇÕES */}
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {hasChildren && (
                                                                <button
                                                                    onClick={() => toggleExpand(item)}
                                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title={isExpanded ? 'Recolher' : 'Expandir detalhes'}
                                                                >
                                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => openComments(item)}
                                                                className={`p-1 rounded transition-colors ${hasWarning ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                                                                title="Comentários e Revisões"
                                                            >
                                                                <MessageSquare className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* SUBPAINEL: Roteiro e Materiais */}
                                                {isExpanded && hasChildren && (
                                                    <tr className="bg-slate-50/70">
                                                        <td colSpan={9} className="p-0 border-b">
                                                            <div className="py-4 pr-6" style={{ paddingLeft: `${indentPx + 56}px` }}>

                                                                {item.processos?.length > 0 && (
                                                                    <div className="mb-5">
                                                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Roteiro de Fabricação</h4>
                                                                        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                                                            <table className="w-full text-left text-xs">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 text-slate-500 border-b">
                                                                                        <th className="py-2 px-4 w-14">Op</th>
                                                                                        <th className="py-2 px-4">Descrição</th>
                                                                                        <th className="py-2 px-4 text-right">Tempo Padrão (min)</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {item.processos.map((proc, i) => (
                                                                                        <tr key={`proc-${i}`} className="hover:bg-slate-50">
                                                                                            <td className="py-2 px-4 font-mono text-blue-600 font-bold">{proc.sequence * 10}</td>
                                                                                            <td className="py-2 px-4 text-slate-700 uppercase">{proc.processName || 'INDEFINIDO'}</td>
                                                                                            <td className="py-2 px-4 font-mono text-right text-slate-600">
                                                                                                {parseFloat(proc.timeMin) > 0 ? parseFloat(proc.timeMin).toString() : '-'}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {item.materiais?.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Materiais de Consumo</h4>
                                                                        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                                                            <table className="w-full text-left text-xs">
                                                                                <thead>
                                                                                    <tr className="bg-slate-50 text-slate-500 border-b">
                                                                                        <th className="py-2 px-4 w-12">Item</th>
                                                                                        <th className="py-2 px-4">Descrição</th>
                                                                                        <th className="py-2 px-4 w-36">Código</th>
                                                                                        <th className="py-2 px-4 w-16 text-center">UN</th>
                                                                                        <th className="py-2 px-4 w-24 text-right">Qtde</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-slate-100">
                                                                                    {item.materiais.map((mat, i) => (
                                                                                        <tr key={`mat-${i}`} className="hover:bg-slate-50">
                                                                                            <td className="py-2 px-4 text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                                                                                            <td className="py-2 px-4">
                                                                                                <span className="text-slate-700 uppercase font-medium">
                                                                                                    {mat.materialDescDetal || mat.materialDesc || '—'}
                                                                                                </span>
                                                                                                {mat.familia && (
                                                                                                    <span className="block text-[10px] text-slate-400 mt-0.5">{mat.familia}</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-2 px-4 font-mono text-slate-500">{mat.materialCode || '—'}</td>
                                                                                            <td className="py-2 px-4 font-mono text-center text-slate-500">{mat.unidade || '—'}</td>
                                                                                            <td className="py-2 px-4 font-mono text-right font-bold text-slate-700">
                                                                                                {parseFloat(mat.quantity || 0).toFixed(4).replace(/\.?0+$/, '')}
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DE COMENTÁRIOS */}
            {isCommentsOpen && commentsItem && (
                <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
                    <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
                        <div className="px-5 py-4 border-b flex justify-between items-center bg-slate-800 text-white">
                            <div>
                                <h3 className="text-lg font-bold font-mono">Revisão Engenharia</h3>
                                <p className="text-xs text-slate-300 truncate w-64">
                                    {commentsItem.CodMatFabricante} — {commentsItem.DescResumo}
                                </p>
                            </div>
                            <button onClick={() => setIsCommentsOpen(false)} className="text-slate-400 hover:text-white">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 bg-slate-50 space-y-4">
                            {isFetchingComments ? (
                                <div className="text-center py-8 text-slate-400">Carregando histórico...</div>
                            ) : comments.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center opacity-50">
                                    <MessageSquare className="w-12 h-12 mb-3 text-slate-400" />
                                    <p className="text-sm">Nenhuma revisão registrada para este item.</p>
                                </div>
                            ) : (
                                comments.map(c => {
                                    const resolved = c.Status === 'RESOLVIDO' || c.Status === 'FEITO';
                                    return (
                                        <div key={c.id} className={`bg-white border rounded-lg shadow-sm overflow-hidden ${resolved ? 'border-green-200' : 'border-amber-200'}`}>
                                            <div className={`px-3 py-2 text-xs font-medium flex justify-between ${resolved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                                <span>{c.Status}</span>
                                                <span>{new Date(c.DataCriacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            </div>
                                            <div className="p-3">
                                                <p className="text-xs font-bold text-slate-700">
                                                    {c.UsuarioCriacao} <span className="font-normal text-slate-400">(Nível {c.Nivel})</span>
                                                </p>
                                                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{c.Comentario}</p>
                                            </div>

                                            {!resolved && resolvingId !== c.id && (
                                                <div className="px-3 py-2 bg-slate-50 border-t flex justify-end">
                                                    <button onClick={() => setResolvingId(c.id)} className="text-xs text-blue-600 font-medium hover:underline">
                                                        Responder / Resolver
                                                    </button>
                                                </div>
                                            )}

                                            {resolvingId === c.id && (
                                                <form onSubmit={(e) => handleResolveComment(e, c.id)} className="p-3 bg-slate-100 border-t space-y-2">
                                                    <select
                                                        value={resolveStatus}
                                                        onChange={(e) => setResolveStatus(e.target.value)}
                                                        className="w-full text-sm border-slate-300 rounded p-1.5"
                                                    >
                                                        <option value="FEITO">Feito / Resolvido</option>
                                                        <option value="EM_ANALISE">Em Análise</option>
                                                        <option value="BLOQUEADO">Bloqueado / Aguardando</option>
                                                    </select>
                                                    <textarea
                                                        className="w-full text-sm border-slate-300 rounded p-2 min-h-20"
                                                        placeholder="Observações do projetista..."
                                                        value={resolveObservation}
                                                        onChange={(e) => setResolveObservation(e.target.value)}
                                                        required
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button type="button" onClick={() => setResolvingId(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 rounded">Cancelar</button>
                                                        <button type="submit" className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">Salvar Status</button>
                                                    </div>
                                                </form>
                                            )}

                                            {c.UsuarioResolucao && (
                                                <div className="p-3 bg-green-50 border-t border-green-100">
                                                    <p className="text-xs font-bold text-green-800 flex justify-between">
                                                        <span>Resposta de {c.UsuarioResolucao}</span>
                                                        <span className="font-normal opacity-70">
                                                            {new Date(c.DataResolucao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </span>
                                                    </p>
                                                    <p className="text-sm text-green-900 mt-1 whitespace-pre-wrap">{c.ObservacaoProjetista}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <form onSubmit={handleAddComment}>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Novo Apontamento / Revisão</label>
                                <textarea
                                    className="w-full border border-slate-300 text-sm rounded-lg p-3 min-h-24 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    placeholder="Descreva o ajuste necessário para este desenho..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={!newComment.trim()}
                                    className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    Enviar Comentário
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SINCOProductStructure;
