import React, { useState, useMemo } from 'react';
import { 
    ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, XCircle, 
    Layers, Search, Folder, FileText, Info, X, ExternalLink,
    Maximize2, Minimize2, ArrowRight, PlusCircle, Paperclip
} from 'lucide-react';

/**
 * Constrói a estrutura em árvore a partir da lista plana de itens da BOM
 */
function buildBOMTree(flatItems) {
    if (!flatItems || flatItems.length === 0) return [];

    const roots = [];
    const stack = [];
    const stackQtd = [1];

    flatItems.forEach((item, index) => {
        let lvl = 0;
        const lvlStr = String(item.nivel || '0').trim();
        if (/^\.+/.test(lvlStr)) {
            lvl = lvlStr.match(/^\.+/)[0].length;
        } else {
            const parsed = parseInt(lvlStr, 10);
            lvl = isNaN(parsed) ? 0 : parsed;
        }

        const unit = parseFloat(String(item.qtd || '1').replace(',', '.')) || 1;
        let computedTotal = 1;
        if (lvl === 0) {
            computedTotal = (item.qtd !== undefined && item.qtd !== '' && !isNaN(parseFloat(String(item.qtd).replace(',', '.')))) ? unit : 1;
            stackQtd[0] = computedTotal;
            stackQtd.length = 1;
        } else {
            const parentTotal = stackQtd[lvl - 1] !== undefined ? stackQtd[lvl - 1] : (stackQtd[stackQtd.length - 1] || 1);
            computedTotal = parentTotal * unit;
            stackQtd[lvl] = computedTotal;
            stackQtd.length = lvl + 1;
        }

        const node = {
            ...item,
            _uniqueId: `${item.id || index}_${item.desenho_cliente || 'item'}_${index}`,
            _levelNum: lvl,
            _computedQtdTotal: item.qtd_total !== undefined && item.qtd_total !== null && item.qtd_total !== '' ? item.qtd_total : computedTotal,
            children: []
        };

        // Mantém a pilha até o nível atual
        stack[lvl] = node;
        stack.length = lvl + 1;

        if (lvl === 0 || !stack[lvl - 1]) {
            roots.push(node);
        } else {
            stack[lvl - 1].children.push(node);
        }
    });

    // Calcula contadores recursivos para cada nó
    function enrichStats(node) {
        let count = 0;
        let divergentes = 0;
        let naoCadastrados = 0;

        node.children.forEach(child => {
            const childStats = enrichStats(child);
            count += 1 + childStats.count;
            divergentes += (child.status_mapeamento === 'DIFERENCA_REVISAO' ? 1 : 0) + childStats.divergentes;
            naoCadastrados += (child.status_mapeamento === 'NAO_ENCONTRADO' ? 1 : 0) + childStats.naoCadastrados;
        });

        node._totalDescendants = count;
        node._divergentDescendants = divergentes;
        node._unmappedDescendants = naoCadastrados;

        return { count, divergentes, naoCadastrados };
    }

    roots.forEach(r => enrichStats(r));
    return roots;
}

export default function WabtecBOMTree({ items = [], onCriarProduto, onAbrirDocs }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('TODOS'); // 'TODOS' | 'IGUAL' | 'DIVERGENTE' | 'NAO_CADASTRADO'
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [selectedItem, setSelectedItem] = useState(null);

    // Constrói a árvore a partir dos itens
    const treeData = useMemo(() => buildBOMTree(items), [items]);

    // Resumo de contagens
    const stats = useMemo(() => {
        const total = items.length;
        const iguais = items.filter(r => r.status_mapeamento === 'ENCONTRADO' || r.revisao_igual === true).length;
        const divergentes = items.filter(r => r.status_mapeamento === 'DIFERENCA_REVISAO').length;
        const naoCadastrados = items.filter(r => r.status_mapeamento === 'NAO_ENCONTRADO').length;
        const subconjuntos = items.filter(r => {
            const lvl = parseInt(r.nivel || '0', 10);
            return lvl === 0 || lvl === 1 || lvl === 2;
        }).length;
        return { total, iguais, divergentes, naoCadastrados, subconjuntos };
    }, [items]);

    // Inicializa nós N0 e N1 como expandidos
    React.useEffect(() => {
        const initialExpanded = new Set();
        function expandTopLevels(nodes, maxLvl = 1) {
            nodes.forEach(n => {
                if (n._levelNum <= maxLvl && n.children.length > 0) {
                    initialExpanded.add(n._uniqueId);
                    expandTopLevels(n.children, maxLvl);
                }
            });
        }
        expandTopLevels(treeData, 1);
        setExpandedIds(initialExpanded);
    }, [treeData]);

    // Ações de expandir/recolher
    const handleExpandAll = () => {
        const allIds = new Set();
        function collect(nodes) {
            nodes.forEach(n => {
                if (n.children.length > 0) {
                    allIds.add(n._uniqueId);
                    collect(n.children);
                }
            });
        }
        collect(treeData);
        setExpandedIds(allIds);
    };

    const handleCollapseAll = () => {
        // Deixa apenas os roots abertos
        const rootIds = new Set();
        treeData.forEach(r => {
            if (r.children.length > 0) rootIds.add(r._uniqueId);
        });
        setExpandedIds(rootIds);
    };

    const handleExpandToLevel = (targetLevel) => {
        const levelIds = new Set();
        function collect(nodes) {
            nodes.forEach(n => {
                if (n._levelNum < targetLevel && n.children.length > 0) {
                    levelIds.add(n._uniqueId);
                    collect(n.children);
                }
            });
        }
        collect(treeData);
        setExpandedIds(levelIds);
    };

    const toggleNode = (nodeId) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    // Verifica correspondência com busca
    const matchesFilter = (node) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (node.desenho_cliente && node.desenho_cliente.toLowerCase().includes(term)) ||
            (node.protheus_cod && node.protheus_cod.toLowerCase().includes(term)) ||
            (node.protheus_desc && node.protheus_desc.toLowerCase().includes(term)) ||
            (node.titulo && node.titulo.toLowerCase().includes(term)) ||
            (node.find_no && String(node.find_no).toLowerCase().includes(term))
        );
    };

    const matchesStatus = (node) => {
        if (statusFilter === 'TODOS') return true;
        if (statusFilter === 'IGUAL') return node.status_mapeamento === 'ENCONTRADO' || node.revisao_igual === true;
        if (statusFilter === 'DIVERGENTE') return node.status_mapeamento === 'DIFERENCA_REVISAO';
        if (statusFilter === 'NAO_CADASTRADO') return node.status_mapeamento === 'NAO_ENCONTRADO';
        return true;
    };

    // Verifica se nó ou algum descendente atende aos filtros
    const hasMatchingDescendant = (node) => {
        if (matchesFilter(node) && matchesStatus(node)) return true;
        return node.children.some(child => hasMatchingDescendant(child));
    };

    // Renderizador recursivo de cada nó
    const renderNode = (node, depth = 0) => {
        const isVisible = hasMatchingDescendant(node);
        if (!isVisible) return null;

        const hasChildren = node.children.length > 0;
        const isExpanded = expandedIds.has(node._uniqueId) || (searchTerm.length > 0 && hasChildren);
        const isMesmaRev = node.status_mapeamento === 'ENCONTRADO' || node.revisao_igual === true;
        const isDivergente = node.status_mapeamento === 'DIFERENCA_REVISAO';
        const isNaoCadastrado = node.status_mapeamento === 'NAO_ENCONTRADO';
        const isHighlighted = searchTerm && matchesFilter(node);

        const levelColors = [
            'bg-slate-900 text-white border-slate-900', // N0
            'bg-blue-700 text-white border-blue-800',   // N1
            'bg-sky-600 text-white border-sky-700',     // N2
            'bg-teal-600 text-white border-teal-700',   // N3
            'bg-slate-600 text-white border-slate-700', // N4+
        ];
        const levelBadgeColor = levelColors[Math.min(node._levelNum, levelColors.length - 1)];

        return (
            <div key={node._uniqueId} className="select-none">
                {/* Linha do Nó */}
                <div 
                    className={`group flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors border ${
                        isHighlighted 
                            ? 'bg-amber-50/80 border-amber-300 shadow-xs' 
                            : 'hover:bg-slate-100/80 border-transparent hover:border-slate-200'
                    }`}
                    style={{ paddingLeft: `${depth * 24 + 8}px` }}
                >
                    {/* Botão Expandir / Recolher */}
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {hasChildren ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNode(node._uniqueId);
                                }}
                                className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
                                title={isExpanded ? 'Recolher subníveis' : 'Expandir subníveis'}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-700" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                )}
                            </button>
                        ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        )}
                    </div>

                    {/* Ícone de Pasta (Conjunto) ou Arquivo (Peça) */}
                    <div className="flex-shrink-0">
                        {hasChildren ? (
                            <Folder className={`w-4 h-4 ${node._levelNum === 0 ? 'text-slate-800' : 'text-blue-600'}`} />
                        ) : (
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                        )}
                    </div>

                    {/* Badge de Nível */}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight border ${levelBadgeColor}`}>
                        N{node._levelNum}
                    </span>

                    {/* Posição Find No */}
                    {node.find_no && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200" title="Posição Find NO">
                            Pos {node.find_no}
                        </span>
                    )}

                    {/* Código WabTec */}
                    <span className="font-bold text-xs text-indigo-950 font-mono tracking-tight">
                        {node.desenho_cliente || '(Sem ID)'}
                    </span>

                    {/* Revisão Cliente */}
                    {(node.rev_convertida || node.rev_cliente_raw) && (
                        <span className="px-1.5 py-0.2 text-[11px] font-mono rounded bg-indigo-50 text-indigo-900 border border-indigo-200" title={`Revisão Cliente: ${node.rev_cliente_raw} (convertida: ${node.rev_convertida})`}>
                            Rev {node.rev_convertida || node.rev_cliente_raw}
                        </span>
                    )}

                    {/* Divisor Visual Suave */}
                    <span className="text-slate-300 text-xs">/</span>

                    {/* Código Lynx (Protheus) */}
                    {node.protheus_cod ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs">
                            {node.protheus_cod}
                            {node.protheus_rev && (
                                <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100/60 px-1 rounded">
                                    R{node.protheus_rev}
                                </span>
                            )}
                            {Number(node.cadastro_novo) === 1 && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200/80 px-1 py-0.2 rounded uppercase tracking-wider" title="Cadastrado recentemente via SINCO">
                                    Novo
                                </span>
                            )}
                        </span>
                    ) : (
                        <span className="text-[11px] text-slate-400 italic">
                            (Não vinculado)
                        </span>
                    )}

                    {/* Status de Conferência de Revisão */}
                    {isMesmaRev ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-300 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            Mesma Revisão
                        </span>
                    ) : isDivergente ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                            title={`Cliente: ${node.rev_cliente_raw} (${node.rev_convertida}) ≠ Lynx: ${node.protheus_rev}`}>
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Rev. Divergente ({node.rev_convertida} ≠ {node.protheus_rev})
                        </span>
                    ) : isNaoCadastrado ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            Não Cadastrado
                        </span>
                    ) : null}

                    {/* Botão de Desenho / PDF */}
                    {onAbrirDocs && (
                        Number(node.total_docs) > 0 ? (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onAbrirDocs(node); }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition cursor-pointer"
                                title="Visualizar Desenho PDF"
                            >
                                <FileText className="w-3 h-3 text-rose-600" />
                                <span>PDF ({node.total_docs})</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onAbrirDocs(node); }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                                title="Anexar PDF / Desenho"
                            >
                                <Paperclip className="w-3 h-3" />
                            </button>
                        )
                    )}

                    {/* Badge do Tipo do Produto */}
                    {node.protheus_tipo && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            node.protheus_tipo === 'PA' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                            node.protheus_tipo === 'PI' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                            node.protheus_tipo === 'MP' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                            'bg-slate-100 text-slate-700 border-slate-300'
                        }`} title={`Tipo SINCO: ${node.protheus_tipo}`}>
                            {node.protheus_tipo}
                        </span>
                    )}

                    {/* Quantidades: Unitária e Total Acumulada */}
                    <div className="ml-auto flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Quantidade unitária no conjunto pai imediato">
                            <span className="text-[10px] text-slate-400 uppercase mr-1">Unit:</span>
                            <span className="font-semibold">{node.qtd !== undefined && node.qtd !== '' ? node.qtd : '1'}</span>
                        </span>
                        <span className="bg-amber-100/90 text-amber-950 border border-amber-300 font-bold px-2 py-0.5 rounded shadow-2xs flex items-center gap-1" title="Quantidade Total acumulada no produto final calculada pela hierarquia da montagem">
                            <span className="text-[10px] text-amber-700 font-normal uppercase">Total:</span>
                            <span>{node._computedQtdTotal !== undefined && node._computedQtdTotal !== null ? (Number(node._computedQtdTotal) % 1 === 0 ? Number(node._computedQtdTotal) : Number(node._computedQtdTotal).toFixed(2)) : (node.qtd || '1')}</span>
                            <span className="text-[10px] font-normal text-amber-700">{node.uom || 'PC'}</span>
                        </span>
                    </div>

                    {/* Descrição resumida */}
                    <span className="hidden xl:inline text-xs text-slate-500 max-w-xs truncate" title={node.protheus_desc || node.titulo}>
                        {node.protheus_desc || node.titulo || ''}
                    </span>

                    {/* Indicador de Filhos / Divergências nos ramos */}
                    {hasChildren && (
                        <div className="flex items-center gap-1 text-[11px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                {node.children.length} {node.children.length === 1 ? 'filho' : 'filhos'}
                            </span>
                            {node._divergentDescendants > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-0.5" title={`${node._divergentDescendants} subitens com revisão divergente abaixo deste nível`}>
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    {node._divergentDescendants}
                                </span>
                            )}
                            {node._unmappedDescendants > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-0.5" title={`${node._unmappedDescendants} subitens não cadastrados abaixo deste nível`}>
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    {node._unmappedDescendants}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Botão de Detalhes */}
                    <button
                        onClick={() => setSelectedItem(node)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition"
                        title="Ver detalhes completos do componente"
                    >
                        <Info className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Subníveis (Filhos) */}
                {hasChildren && isExpanded && (
                    <div className="relative border-l border-slate-200/80 ml-5">
                        {node.children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Barra de Ferramentas Superior */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-slate-50 border-b border-slate-200 rounded-t-xl">
                {/* Filtros de Status */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                        onClick={() => setStatusFilter('TODOS')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                            statusFilter === 'TODOS' 
                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        Todos ({stats.total})
                    </button>
                    <button 
                        onClick={() => setStatusFilter('IGUAL')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                            statusFilter === 'IGUAL' 
                                ? 'bg-green-600 text-white border-green-600 shadow-sm' 
                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mesma Revisão ({stats.iguais})
                    </button>
                    <button 
                        onClick={() => setStatusFilter('DIVERGENTE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                            statusFilter === 'DIVERGENTE' 
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Divergentes ({stats.divergentes})
                    </button>
                    <button 
                        onClick={() => setStatusFilter('NAO_CADASTRADO')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                            statusFilter === 'NAO_CADASTRADO' 
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        Não Cadastrado ({stats.naoCadastrados})
                    </button>
                </div>

                {/* Controles de Nível, Busca e Expansão */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Botões Rápidos de Nível */}
                    <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 text-xs font-medium text-slate-600">
                        <span className="px-2 py-1 text-[11px] text-slate-400 font-mono">Abrir:</span>
                        <button 
                            onClick={() => handleExpandToLevel(1)}
                            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition"
                            title="Expandir até Nível 1"
                        >
                            N1
                        </button>
                        <button 
                            onClick={() => handleExpandToLevel(2)}
                            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition"
                            title="Expandir até Nível 2"
                        >
                            N2
                        </button>
                        <button 
                            onClick={() => handleExpandToLevel(3)}
                            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition"
                            title="Expandir até Nível 3"
                        >
                            N3
                        </button>
                        <button 
                            onClick={handleExpandAll}
                            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition flex items-center gap-1"
                            title="Expandir todos os nós"
                        >
                            <Maximize2 className="w-3 h-3" /> Todos
                        </button>
                        <button 
                            onClick={handleCollapseAll}
                            className="px-2 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition flex items-center gap-1"
                            title="Recolher árvore"
                        >
                            <Minimize2 className="w-3 h-3" /> Fechar
                        </button>
                    </div>

                    {/* Campo de Busca */}
                    <div className="relative w-full sm:w-56">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar código ou peça..."
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Visualizador da Árvore Otimizado */}
            <div className="p-3 bg-white rounded-b-xl border border-slate-200 flex-1 min-h-[440px] max-h-[calc(100vh-220px)] overflow-auto">
                {treeData.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                        <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-[1.5]" />
                        <p className="font-semibold text-sm">Nenhum item para exibir na árvore.</p>
                        <p className="text-xs text-slate-400 mt-1">Carregue um arquivo ou selecione um lote existente.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {treeData.map(rootNode => renderNode(rootNode, 0))}
                    </div>
                )}
            </div>

            {/* Painel Lateral (Drawer) de Detalhes do Item Selecionado */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
                        {/* Header do Drawer */}
                        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div>
                                <span className="text-[11px] font-mono uppercase font-bold text-slate-500 tracking-wider">
                                    Detalhes do Componente
                                </span>
                                <h3 className="text-base font-bold text-slate-900 font-mono flex items-center gap-2 mt-0.5">
                                    {selectedItem.desenho_cliente}
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-900 border border-indigo-200">
                                        N{selectedItem._levelNum}
                                    </span>
                                </h3>
                            </div>
                            <button 
                                onClick={() => setSelectedItem(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Drawer */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
                            {/* Card Status de Revisão */}
                            <div className={`p-4 rounded-xl border ${
                                selectedItem.status_mapeamento === 'ENCONTRADO' || selectedItem.revisao_igual
                                    ? 'bg-green-50/70 border-green-200 text-green-950'
                                    : selectedItem.status_mapeamento === 'DIFERENCA_REVISAO'
                                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                                    : 'bg-rose-50/70 border-rose-200 text-rose-950'
                            }`}>
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    {selectedItem.status_mapeamento === 'ENCONTRADO' || selectedItem.revisao_igual ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            Revisão Compatível (100% Sincronizada)
                                        </>
                                    ) : selectedItem.status_mapeamento === 'DIFERENCA_REVISAO' ? (
                                        <>
                                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                                            Divergência de Revisão Detectada
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-4 h-4 text-rose-600" />
                                            Item Não Cadastrado no SINCO
                                        </>
                                    )}
                                </div>
                                <p className="text-[11px] opacity-90">
                                    {selectedItem.status_detalhe || 'Conferência executada contra o cadastro do SINCO.'}
                                </p>
                            </div>

                            {/* Botão de Ação: Criar Produto no SINCO se não vinculado */}
                            {!selectedItem.protheus_cod && onCriarProduto && (
                                <button
                                    type="button"
                                    onClick={() => onCriarProduto(selectedItem)}
                                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    <span>Criar este Produto no SINCO</span>
                                </button>
                            )}

                            {/* Tabela Comparativa de Atributos */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider border-b pb-1">
                                    Vínculos de Engenharia
                                </h4>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Cód. WabTec (ID)</span>
                                        <div className="font-bold font-mono text-indigo-950 mt-0.5">{selectedItem.desenho_cliente || '-'}</div>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Número Lynx (B1_COD)</span>
                                        <div className="font-bold font-mono text-emerald-950 mt-0.5">{selectedItem.protheus_cod || '-'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Rev. Cliente (Orig/Conv)</span>
                                        <div className="font-bold font-mono text-slate-900 mt-0.5">
                                            {selectedItem.rev_convertida || '-'} 
                                            {selectedItem.rev_cliente_raw && ` (${selectedItem.rev_cliente_raw})`}
                                        </div>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Rev. Lynx (Z1_REV)</span>
                                        <div className="font-bold font-mono text-slate-900 mt-0.5">{selectedItem.protheus_rev || '-'}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Unidade de Medida (UM)</span>
                                        <div className="font-bold font-mono text-slate-900 mt-0.5">{selectedItem.uom || '-'}</div>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Tipo SINCO (B1_TIPO)</span>
                                        <div className="font-bold font-mono text-blue-900 mt-0.5">{selectedItem.protheus_tipo || '-'}</div>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Descrição Lynx</span>
                                    <div className="font-medium text-slate-800 mt-0.5">{selectedItem.protheus_desc || '-'}</div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Descrição WabTec (Name)</span>
                                    <div className="font-medium text-slate-700 mt-0.5">{selectedItem.titulo || '-'}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Qtd Unitária (Por Conjunto Pai)</span>
                                        <div className="font-bold font-mono text-slate-900 mt-0.5">{selectedItem.qtd || '1'} {selectedItem.uom || 'PC'}</div>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-300">
                                        <span className="text-[10px] text-amber-700 uppercase font-bold">Qtd Total (Acumulada no Topo)</span>
                                        <div className="font-bold font-mono text-amber-950 mt-0.5 text-sm">
                                            {selectedItem._computedQtdTotal !== undefined && selectedItem._computedQtdTotal !== null
                                                ? (Number(selectedItem._computedQtdTotal) % 1 === 0 ? Number(selectedItem._computedQtdTotal) : Number(selectedItem._computedQtdTotal).toFixed(2))
                                                : (selectedItem.qtd || '1')} {selectedItem.uom || 'PC'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Unidade de Medida</span>
                                        <div className="font-bold font-mono text-slate-900 mt-0.5">{selectedItem.uom || 'PC'}</div>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Posição Find NO</span>
                                        <div className="font-bold font-mono text-slate-900 mt-0.5">{selectedItem.find_no || '-'}</div>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Item Pai (Parent)</span>
                                    <div className="font-medium font-mono text-slate-700 mt-0.5">{selectedItem.item_pai || '-'}</div>
                                </div>

                                {selectedItem.data_liberacao && (
                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Data / Status Liberação WabTec</span>
                                        <div className="font-medium text-slate-700 mt-0.5">
                                            {selectedItem.data_liberacao} {selectedItem.status_liberacao ? `(${selectedItem.status_liberacao})` : ''}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer do Drawer */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold text-xs transition"
                            >
                                Fechar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
