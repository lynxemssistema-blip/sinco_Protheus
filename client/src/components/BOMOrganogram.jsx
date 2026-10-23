import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import * as htmlToImage from 'html-to-image';
import {
    Plus, Minus, RefreshCw, Package, Layers, Wrench, FileText,
    Play, Calendar, Clock, ChevronDown, ChevronRight, Eye, Move, Search,
    RectangleVertical, Target, Maximize2, Camera, Truck
} from 'lucide-react';
import ItemRomaneiosModal from './ItemRomaneiosModal';

const fmtDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw).replace(/-/g, '').trim();
    if (s.length === 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    if (raw instanceof Date || String(raw).includes('T')) {
        const d = new Date(raw);
        if (!isNaN(d)) return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    return String(raw).substring(0, 10) || '—';
};

const RomaneioBadge = ({ romaneios, produto, descricao, onOpenDetails }) => {
    if (!romaneios || romaneios.length === 0) return null;

    const totalEnviado = romaneios.reduce((s, r) => s + (Number(r.quantidade_enviada) || 0), 0);
    const totalRecebido = romaneios.reduce((s, r) => s + (Number(r.quantidade_recebida) || 0), 0);
    const totalSaldo = romaneios.reduce((s, r) => s + (Number(r.saldo_pendente) || 0), 0);

    const isTodosRecebidos = totalSaldo <= 0 && totalEnviado > 0;
    const isParcial = totalRecebido > 0 && !isTodosRecebidos;

    const badgeColor = isTodosRecebidos 
        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
        : isParcial
            ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 hover:border-blue-400'
            : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400';

    const iconColor = isTodosRecebidos ? 'text-emerald-600' : isParcial ? 'text-blue-600' : 'text-amber-600';

    const lines = romaneios.map(r => 
        `• Rom. #${r.romaneio_id} (${r.fornecedor_nome || 'Terceiro'}): Env ${r.quantidade_enviada} | Ret ${r.quantidade_recebida} | Saldo ${r.saldo_pendente}`
    );

    const tooltipText = `Histórico de Terceiros (${romaneios.length} ${romaneios.length === 1 ? 'Romaneio' : 'Romaneios'}):\n` +
        `• Total Enviado: ${totalEnviado} PC | Total Recebido: ${totalRecebido} PC | Saldo: ${totalSaldo} PC\n\n` +
        lines.join('\n') +
        `\n\n👉 Clique para abrir todos os romaneios e histórico de entregas`;

    const handleClick = (e) => {
        e.stopPropagation();
        if (onOpenDetails) {
            onOpenDetails({ produto, descricao, romaneios });
        }
    };

    return (
        <div className="mt-1 flex justify-center">
            <button 
                type="button"
                onClick={handleClick}
                className={`inline-flex items-center gap-1 text-[9px] font-bold border px-1.5 py-0.5 rounded shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95 ${badgeColor}`}
                title={tooltipText}
            >
                <Truck className={`w-2.5 h-2.5 ${iconColor}`} />
                <span>
                    {romaneios.length === 1 ? (
                        <>
                            Rom. #{romaneios[0].romaneio_id}
                            {isTodosRecebidos ? ` (${totalRecebido} PC)` : isParcial ? ` (${totalRecebido}/${totalEnviado})` : ` (${totalEnviado} PC)`}
                        </>
                    ) : (
                        <>
                            {romaneios.length} Rom.
                            {isTodosRecebidos ? ` (${totalRecebido} PC)` : isParcial ? ` (${totalRecebido}/${totalEnviado})` : ` (${totalEnviado} PC)`}
                        </>
                    )}
                </span>
            </button>
        </div>
    );
};

export default function BOMOrganogram({
    data,
    onApontar,
    onViewDrawing,
    onSelectMaterial,
    activeRootKey,
    setActiveRootKey,
    showFocusPanel = true
}) {
    const [zoom, setZoom] = useState(0.85);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [collapsedNodes, setCollapsedNodes] = useState({});
    const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
    const [romaneiosModalData, setRomaneiosModalData] = useState(null);
    const [searchOp, setSearchOp] = useState('');
    const [showA4Guide, setShowA4Guide] = useState(false);
    const dragDistance = useRef(0);
    const containerRef = useRef(null);
    const contentRef = useRef(null);

    // Ajusta o zoom e posição para enquadrar toda a estrutura na tela de uma só vez
    const handleFitToScreen = () => {
        if (!containerRef.current || !contentRef.current) return;
        const container = containerRef.current;
        const content = contentRef.current;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const contentWidth = content.offsetWidth || content.scrollWidth;
        const contentHeight = content.offsetHeight || content.scrollHeight;

        if (contentWidth > 0 && contentHeight > 0) {
            const availableWidth = Math.max(200, containerWidth - 140);
            const availableHeight = Math.max(200, containerHeight - 140);

            const scaleX = availableWidth / contentWidth;
            const scaleY = availableHeight / contentHeight;
            let targetZoom = Math.min(scaleX, scaleY);

            targetZoom = Math.max(0.15, Math.min(1.2, Number(targetZoom.toFixed(2))));

            setZoom(targetZoom);
            setPan({ x: 0, y: 0 });
        }
    };

    // Captura a imagem da estrutura em ultra-definição nítida nativa via html-to-image e copia para o WhatsApp (Ctrl+V)
    const handleCopyScreenshot = async () => {
        if (!contentRef.current) return;
        const toastId = toast.loading('Gerando imagem em altíssima definição...');
        try {
            const node = contentRef.current;
            const scrollW = node.scrollWidth || node.offsetWidth || 800;
            const scrollH = node.scrollHeight || node.offsetHeight || 600;

            const blob = await htmlToImage.toBlob(node, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                width: scrollW + 48,
                height: scrollH + 48,
                skipFonts: true,
                style: {
                    transform: 'none',
                    left: '0',
                    top: '0',
                    position: 'static',
                    margin: '0 auto',
                    padding: '24px',
                    backgroundColor: '#ffffff'
                }
            });

            if (!blob) {
                toast.update(toastId, { render: 'Falha ao processar imagem.', type: 'error', isLoading: false, autoClose: 3000 });
                return;
            }

            try {
                if (navigator.clipboard && window.ClipboardItem) {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    toast.update(toastId, { 
                        render: '📸 Imagem 100% nítida copiada! Cole no WhatsApp com Ctrl+V.', 
                        type: 'success', 
                        isLoading: false, 
                        autoClose: 4000 
                    });
                } else {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `estrutura-${activeRootItem?.op || 'produto'}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.update(toastId, { 
                        render: 'Imagem baixada em alta resolução! Pronto para enviar no WhatsApp.', 
                        type: 'info', 
                        isLoading: false, 
                        autoClose: 4000 
                    });
                }
            } catch (clipErr) {
                console.warn('Clipboard write error, falling back to download:', clipErr);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `estrutura-${activeRootItem?.op || 'produto'}.png`;
                a.click();
                URL.revokeObjectURL(url);
                toast.update(toastId, { 
                    render: 'Imagem baixada em alta resolução! Pronto para enviar no WhatsApp.', 
                    type: 'info', 
                    isLoading: false, 
                    autoClose: 4000 
                });
            }
        } catch (err) {
            console.error('Erro ao capturar print com html-to-image:', err);
            toast.update(toastId, { render: 'Erro ao gerar print: ' + err.message, type: 'error', isLoading: false, autoClose: 3000 });
        }
    };

    // Centraliza e expande ao mudar o Foco OP
    useEffect(() => {
        setPan({ x: 0, y: 0 });
        setZoom(0.85);
        setCollapsedNodes({});
    }, [activeRootKey]);

    // Mapeia todas as OPs raízes de todos os pedidos retornados
    const rootItens = React.useMemo(() => {
        if (!data?.pedidos) return [];
        return data.pedidos.flatMap(p => p.treeItens || []);
    }, [data]);

    // Define a OP raiz ativa por padrão no início ou quando o filtro de busca lateral é aplicado
    useEffect(() => {
        if (!rootItens || rootItens.length === 0) return;
        const filtered = rootItens.filter(r => {
            if (!searchOp) return true;
            const term = searchOp.toLowerCase();
            const opCode = `${r.op}${r.item_op}${r.sequen}`.toLowerCase();
            const prodCode = (r.produto || '').toLowerCase();
            const refCode = (r.ref_cliente || '').toLowerCase();
            const descCode = (r.desc_produto || '').toLowerCase();
            return opCode.includes(term) || prodCode.includes(term) || refCode.includes(term) || descCode.includes(term);
        });
        if (filtered.length > 0) {
            const isStillPresent = filtered.some(r => `${r.op}_${r.item_op}_${r.sequen}` === activeRootKey);
            if (!activeRootKey || (!isStillPresent && activeRootKey !== 'all')) {
                const first = filtered[0];
                setActiveRootKey(`${first.op}_${first.item_op}_${first.sequen}`);
            }
        }
    }, [searchOp, rootItens, activeRootKey, setActiveRootKey]);

    // Encontra o item raiz selecionado
    const activeRootItem = rootItens.find(r => 
        `${r.op}_${r.item_op}_${r.sequen}` === activeRootKey
    ) || rootItens[0];

    // Resetar visualização
    const handleReset = () => {
        setZoom(0.85);
        setPan({ x: 0, y: 0 });
    };

    // Pan & Zoom handlers
    const handleMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('.interactive-el')) return;
        setIsDragging(true);
        dragDistance.current = 0;
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        dragDistance.current += Math.abs(e.movementX) + Math.abs(e.movementY);
        setPan({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleNativeWheel = (e) => {
            // Se o mouse estiver sobre a lista lateral (com scroll), deixa rolar a lista normalmente
            if (e.target.closest('.overflow-y-auto')) {
                return;
            }
            e.preventDefault();
            const factor = 0.08;
            setZoom(prevZoom => {
                let newZoom = prevZoom + (e.deltaY < 0 ? factor : -factor);
                return Math.max(0.15, Math.min(2.5, newZoom));
            });
        };

        // passive: false é obrigatório para o preventDefault() funcionar em wheel events
        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleNativeWheel);
    }, []);

    const handleZoomIn = () => setZoom(z => Math.min(2.5, z + 0.15));
    const handleZoomOut = () => setZoom(z => Math.max(0.15, z - 0.15));

    const toggleCollapse = (nodeKey, defaultCollapsed) => {
        setCollapsedNodes(prev => {
            const current = prev[nodeKey] !== undefined ? prev[nodeKey] : defaultCollapsed;
            return {
                ...prev,
                [nodeKey]: !current
            };
        });
    };

    // Cores de status de operação
    const getOpStatusColor = (status) => {
        if (status === 'done') return 'bg-green-500 text-white ring-green-600/30';
        if (status === 'in_progress') return 'bg-blue-500 text-white ring-blue-600/30 animate-pulse';
        return 'bg-slate-300 text-slate-700 ring-slate-400/20';
    };

    // Renderizador Recursivo dos Nós da Árvore
    const renderTreeNodes = (item, level = 0, path = 'root') => {
        const isOP = !!item.op;
        const nodeKey = isOP ? `${item.op}_${item.item_op}_${item.sequen}` : `mp_${item.codigo}_${path}`;
        
        // Colapsado por padrão: false (tudo expandido por padrão como solicitado)
        const defaultCollapsed = false;
        const isCollapsed = collapsedNodes[nodeKey] !== undefined 
            ? collapsedNodes[nodeKey] 
            : defaultCollapsed;

        const pureMaterials = isOP 
            ? (item.materiais || []).filter(m => !item.subItens?.some(sub => sub.produto?.trim() === m.codigo?.trim()))
            : [];

        const hasChildren = isOP && ((item.subItens && item.subItens.length > 0) || pureMaterials.length > 0);

        return (
            <li key={nodeKey}>
                {/* O Card do Nó */}
                <div className={`relative flex flex-col items-center node-card-parent-line ${hasChildren && !isCollapsed ? 'has-children-line' : ''}`}>
                    {isOP ? (
                        /* Card de OP (PA / PI) */
                        <div 
                            onClick={() => setSelectedNodeDetails(item)}
                            className={`w-64 bg-white rounded-xl shadow-md border-8 p-3 transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 relative z-10 ${
                                item.status === 'done' 
                                    ? 'border-green-400 ring-4 ring-green-50' 
                                    : item.status === 'in_progress' 
                                        ? 'border-blue-400 ring-4 ring-blue-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {/* Top Badge */}
                            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                <div className="flex items-center gap-1">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                        level === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        {level === 0 ? 'PA (Principal)' : 'PI (Intermediário)'}
                                    </span>
                                    {level === 0 && (item.status === 'done' || (item.qtde_pendente !== undefined && Number(item.qtde_pendente) <= 0)) && Number(item.pv_saldo) > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider" title="Produção da OP concluída no chão de fábrica, aguardando faturamento/entrega">
                                            <Target className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                                            Saldo PV: {item.pv_saldo} {item.um}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onViewDrawing(item.produto); }}
                                        className={`p-1 rounded hover:bg-slate-100 transition-colors interactive-el ${
                                            item.has_pdf ? 'text-red-500 bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'text-slate-400 hover:text-blue-500'
                                        }`}
                                        title={item.has_pdf ? "Visualizar PDF" : "Sem desenho técnico"}
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* OP Code */}
                            <div className="font-mono text-[10px] font-bold text-slate-400 mb-1">
                                OP: {item.op}{item.item_op}{item.sequen}
                            </div>

                            {/* Product Code & Desc */}
                            <div className="font-bold text-slate-800 text-xs truncate" title={item.produto}>
                                {item.produto}
                            </div>
                            <div className="text-[9px] text-slate-500 truncate mb-2" title={item.desc_produto}>
                                {item.desc_produto}
                            </div>

                            {/* Progress & Qtd */}
                            <div className="flex items-center justify-between text-[10px] mb-2 border-t border-slate-100 pt-2">
                                <div>
                                    <span className="text-slate-400 font-medium">Qtd: </span>
                                    <span className="font-bold text-slate-700">{item.qtde}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-medium">Feito: </span>
                                    <span className={`font-bold ${item.qtde_feita >= item.qtde ? 'text-green-600' : 'text-blue-600'}`}>
                                        {item.qtde_feita}
                                    </span>
                                </div>
                                <span className="font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded text-[9px]">
                                    {item.pct_global}%
                                </span>
                            </div>

                            {/* Romaneio Badge se houver */}
                            {item.romaneios && item.romaneios.length > 0 && (
                                <RomaneioBadge 
                                    romaneios={item.romaneios} 
                                    produto={item.produto} 
                                    descricao={item.desc_produto} 
                                    onOpenDetails={setRomaneiosModalData} 
                                />
                            )}

                            {/* Recursos / Operações (Círculos) */}
                            {item?.recursos && item.recursos.length > 0 && (() => {
                                const uniqueRecursos = item.recursos.filter((r, idx, arr) => 
                                    arr.findIndex(x => String(x.operac).trim() === String(r.operac).trim()) === idx
                                );
                                return (
                                    <div className="border-t border-slate-100 pt-2 flex flex-wrap gap-1.5 justify-center">
                                        {uniqueRecursos.map((r, rIdx) => (
                                            <button
                                                key={`${r.operac}_${r.recurso}_${rIdx}`}
                                                onClick={(e) => { e.stopPropagation(); onApontar(item, r); }}
                                                className={`interactive-el group relative flex items-center justify-center w-7 h-7 rounded-full font-mono text-[9px] font-bold ring-2 transition-all hover:scale-110 hover:shadow-sm ${getOpStatusColor(r.status)}`}
                                            >
                                                {r.operac}
                                                
                                                {/* Hover tooltip premium flutuante */}
                                                <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 hidden group-hover:flex flex-col items-center">
                                                    <span className="bg-slate-900 text-white text-[10px] rounded p-2 shadow-lg whitespace-nowrap leading-tight text-left">
                                                        <span className="font-bold block text-blue-300">Op {r.operac} - {r.recurso} — {r.desc_recurso}</span>
                                                        <span className="block text-slate-400 font-mono text-[9px]">Código Recurso: {r.recurso}</span>
                                                        {r.data_planejada_inicio && (
                                                            <span className="block text-amber-300 font-semibold mt-0.5">📅 Plan: {fmtDate(r.data_planejada_inicio)}</span>
                                                        )}
                                                        <span className="block text-slate-300 mt-0.5">Progresso: {r.qtde_produzida} / {r.qtde_planejada} ({r.pct}%)</span>
                                                    </span>
                                                    <span className="w-2 h-2 bg-slate-900 rotate-45 -mt-1"></span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Collapse/Expand indicator button */}
                            {hasChildren && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleCollapse(nodeKey, defaultCollapsed); }}
                                    className="interactive-el absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 z-20"
                                >
                                    {isCollapsed ? <Plus className="w-3.5 h-3.5 text-blue-600" /> : <Minus className="w-3.5 h-3.5 text-slate-600" />}
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Card de Matéria-Prima / Insumo (MP) */
                        <div 
                            onClick={() => setSelectedNodeDetails(item)}
                            className="w-56 bg-orange-50/40 rounded-lg border border-orange-200 p-2.5 hover:shadow-md cursor-pointer transition-all relative z-10"
                        >
                            <div className="flex items-center gap-1.5 mb-1 justify-between">
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                                    <Layers className="w-2.5 h-2.5" /> MP (Insumo)
                                </span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onViewDrawing(item.codigo); }}
                                    className={`p-0.5 rounded hover:bg-slate-100 transition-colors interactive-el ${
                                        item.has_pdf ? 'text-red-500 bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'text-slate-400 hover:text-blue-500'
                                    }`}
                                    title={item.has_pdf ? "Visualizar PDF" : "Sem desenho técnico"}
                                >
                                    <FileText className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="font-mono text-xs font-bold text-orange-950 truncate" title={item.codigo}>
                                {item.codigo}
                            </div>
                            <div className="text-[9px] text-slate-500 truncate" title={item.descricao}>
                                {item.descricao}
                            </div>
                            <div className="text-[10px] text-slate-600 font-semibold mt-1">
                                Qtd Total: {item.qtde_total} <span className="text-[9px] text-slate-400 font-normal">{item.um}</span>
                            </div>
                            {item.romaneios && item.romaneios.length > 0 && (
                                <RomaneioBadge 
                                    romaneios={item.romaneios} 
                                    produto={item.codigo} 
                                    descricao={item.descricao} 
                                    onOpenDetails={setRomaneiosModalData} 
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Sub-nós (Renderizados apenas se não estiver colapsado) */}
                {hasChildren && !isCollapsed && (
                    <ul>
                        {item.subItens.map((sub, idx) => renderTreeNodes(sub, level + 1, `${path}_c${idx}`))}
                        {pureMaterials.map((mat, idx) => renderTreeNodes(mat, level + 1, `${path}_m${idx}`))}
                    </ul>
                )}
            </li>
        );
    };

    return (
        <div className="flex-1 flex overflow-hidden relative bg-slate-50 rounded-b-xl border border-slate-200 select-none w-full h-full min-h-[500px]">
            
            {/* Bloco de CSS Embutido de Conexões de Organograma */}
            <style dangerouslySetInnerHTML={{ __html: `
                /* Reset absoluto para árvore e filhos */
                .organogram-tree, .organogram-tree ul {
                    list-style-type: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    display: flex !important;
                    justify-content: center !important;
                    gap: 16px !important;
                    position: relative;
                }
                .organogram-tree li {
                    list-style-type: none !important;
                    padding: 24px 8px 0 8px !important;
                    margin: 0 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    position: relative;
                }
                
                /* Conectores Horizontais Superiores */
                .organogram-tree li::before, .organogram-tree li::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 50%;
                    border-top: 2px solid #cbd5e1;
                    width: 50%;
                    height: 24px;
                }
                .organogram-tree li::after {
                    right: auto;
                    left: 50%;
                }
                
                /* Casos Especiais de Alinhamento e Conexão */
                .organogram-tree li:only-child::after, .organogram-tree li:only-child::before {
                    display: none !important;
                }
                .organogram-tree li:only-child {
                    padding-top: 0 !important;
                }
                .organogram-tree li:first-child::before, .organogram-tree li:last-child::after {
                    border: 0 none !important;
                }
                .organogram-tree li:last-child::before {
                    border-right: 2px solid #cbd5e1 !important;
                    border-radius: 0 8px 0 0;
                }
                .organogram-tree li:first-child::after {
                    border-radius: 8px 0 0 0;
                }
                
                /* Conector Vertical Superior */
                .organogram-tree ul::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 50%;
                    border-left: 2px solid #cbd5e1;
                    width: 0;
                    height: 24px;
                    transform: translateX(-50%);
                }
                
                /* Linha Vertical Inferior saindo do nó pai */
                .has-children-line::after {
                    content: '';
                    position: absolute;
                    bottom: -24px;
                    left: 50%;
                    border-left: 2px solid #cbd5e1;
                    width: 0;
                    height: 24px;
                    transform: translateX(-50%);
                    z-index: 5;
                }
                
                /* Custom Scrollbar para o Grid Lateral */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
            `}} />

            {/* Canvas Principal Interativo */}
            <div 
                ref={containerRef}
                className="flex-1 w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing bg-slate-50"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Guia de Referência A4 Vertical (visual apenas, não afeta o layout real) */}
                {showA4Guide && (
                    <div
                        className="absolute pointer-events-none border-2 border-dashed border-red-400/70"
                        style={{
                            width: '794px',
                            height: '1123px',
                            top: '40%',
                            left: '50%',
                            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: 'top center',
                            transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
                            zIndex: 5,
                        }}
                    >
                        <span className="absolute -top-7 left-0 whitespace-nowrap text-[10px] font-bold text-red-500 bg-white/90 px-1.5 py-0.5 rounded border border-red-200 shadow-sm">
                            Referência A4 Vertical (210×297mm)
                        </span>
                    </div>
                )}

                {/* Elemento de Árvore com Transformações Absolutas Centralizadas */}
                <div
                    data-organogram-transform-wrapper="true"
                    className="absolute"
                    style={{
                        top: '40%',
                        left: '50%',
                        transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'top center',
                        transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                >
                    {data && data.pedidos && data.pedidos.length > 0 && activeRootItem ? (
                        <div 
                            ref={contentRef} 
                            data-organogram-content="true"
                            className="flex flex-col items-center p-4 bg-white rounded-2xl"
                        >
                            <ul className="organogram-tree">
                                {renderTreeNodes(activeRootItem, 0, `root`)}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-slate-400 text-center pointer-events-none select-none mt-20">
                            <Move className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-semibold">Nenhuma árvore gerada</p>
                        </div>
                    )}
                </div>

                {/* Grid Vertical de Foco na OP (Múltiplas OPs) */}
                {showFocusPanel && rootItens.length > 1 && (
                    <div className="absolute top-5 left-5 bg-white/95 backdrop-blur-xs border border-slate-200 p-3 rounded-xl shadow-md z-20 flex flex-col gap-2 max-h-[calc(100%-40px)] w-64 overflow-hidden">
                        <span className="text-[11px] font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Foco na OP</span>
                        
                        <div className="relative mt-1">
                            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Buscar OP ou produto..."
                                className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50"
                                value={searchOp}
                                onChange={(e) => setSearchOp(e.target.value)}
                            />
                        </div>

                        <div className="overflow-y-auto pr-1 flex flex-col gap-1.5 custom-scrollbar mt-1">
                            {rootItens.filter(r => {
                                if (!searchOp) return true;
                                const term = searchOp.toLowerCase();
                                const opCode = `${r.op}${r.item_op}${r.sequen}`.toLowerCase();
                                const prodCode = (r.produto || '').toLowerCase();
                                const refCode = (r.ref_cliente || '').toLowerCase();
                                const descCode = (r.desc_produto || '').toLowerCase();
                                return opCode.includes(term) || prodCode.includes(term) || refCode.includes(term) || descCode.includes(term);
                            }).map((r) => {
                                const key = `${r.op}_${r.item_op}_${r.sequen}`;
                                const isActive = activeRootKey === key;
                                return (
                                    <button 
                                        key={key}
                                        onClick={() => setActiveRootKey(key)}
                                        className={`text-left px-3 py-2.5 rounded-lg transition-all border-4 interactive-el ${
                                            isActive 
                                            ? 'bg-red-50/50 border-red-500 text-red-950 shadow-md ring-2 ring-red-100 transform -translate-y-px font-semibold' 
                                            : `bg-white text-slate-600 hover:bg-slate-50 hover:-translate-y-0.5 ${
                                                r.status === 'done' ? 'border-green-400' :
                                                r.status === 'in_progress' ? 'border-blue-400' :
                                                'border-slate-200'
                                            }`
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-mono font-bold text-slate-500">OP: {r.op}{r.item_op}{r.sequen}</span>
                                            <div className="flex items-center gap-1.5" title={r.status === 'done' ? 'Concluída' : r.status === 'in_progress' ? 'Em Andamento' : 'Aguardando'}>
                                                <span className={`text-[9px] font-bold ${
                                                    r.status === 'done' ? 'text-green-600' :
                                                    r.status === 'in_progress' ? 'text-blue-600' :
                                                    'text-slate-400'
                                                }`}>{r.pct_global}%</span>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    r.status === 'done' ? 'bg-green-500' :
                                                    r.status === 'in_progress' ? 'bg-blue-500 animate-pulse' :
                                                    'bg-slate-300'
                                                }`}></span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold leading-tight">
                                            <span className="truncate" title={r.produto}>{r.produto}</span>
                                            {r.ref_cliente && (
                                                <span className="text-[9px] font-mono font-normal text-slate-500 bg-slate-100 px-1 py-0.2 rounded" title="Referência do Cliente">
                                                    Ref: {r.ref_cliente}
                                                </span>
                                            )}
                                        </div>
                                        {r.desc_produto && <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5" title={r.desc_produto}>{r.desc_produto}</div>}
                                        
                                        {(r.status === 'done' || (r.qtde_pendente !== undefined && Number(r.qtde_pendente) <= 0)) && Number(r.pv_saldo) > 0 && (
                                            <div className="mt-1">
                                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs" title="Produção Concluída • Aguardando Faturamento no Pedido">
                                                    <Target className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                                                    Saldo PV: {r.pv_saldo} {r.um} (Produzido)
                                                </span>
                                            </div>
                                        )}
                                        
                                        {(r.dt_pcp || (r.qtde_pcp !== undefined && r.qtde_pcp !== null)) && (
                                            <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-slate-100">
                                                {r.dt_pcp && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded" title="Data prevista pelo PCP">
                                                        <Calendar className="w-2.5 h-2.5 text-indigo-500" />
                                                        PCP: {fmtDate(r.dt_pcp)}
                                                    </span>
                                                )}
                                                {r.qtde_pcp !== undefined && r.qtde_pcp !== null && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded" title="Quantidade PCP">
                                                        <Package className="w-2.5 h-2.5 text-emerald-500" />
                                                        Qtd PCP: {r.qtde_pcp}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Controles Flutuantes do Canvas */}
                <div className="absolute bottom-5 right-5 flex flex-col gap-2 z-20">
                    <button
                        onClick={() => setShowA4Guide(v => !v)}
                        className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold border interactive-el ${
                            showA4Guide
                                ? 'bg-red-500 border-red-500 text-white hover:bg-red-600'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Referência A4 Vertical (apenas visual)"
                    >
                        <RectangleVertical className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleZoomIn}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold"
                        title="Aumentar Zoom"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleZoomOut}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold"
                        title="Diminuir Zoom"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleFitToScreen}
                        className="bg-white border border-slate-200 hover:bg-blue-50 text-blue-600 hover:text-blue-700 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold interactive-el"
                        title="Ajustar Estrutura à Tela (Ver tudo de uma só vez)"
                    >
                        <Maximize2 className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleCopyScreenshot}
                        className="bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold interactive-el"
                        title="Copiar Print da Estrutura para WhatsApp (Ctrl+V)"
                    >
                        <Camera className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleReset}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold interactive-el"
                        title="Resetar Posição e Zoom Padrão"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Mini Legenda Flutuante (Lado Direito se houver Dropdown) */}
                <div className="absolute top-5 right-5 bg-white/95 backdrop-blur-xs border border-slate-200 p-3 rounded-xl shadow-md z-20 max-w-xs flex flex-col gap-2">
                    <h3 className="text-[11px] font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wider">Legenda</h3>
                    <div className="flex flex-col gap-1.5 text-[10px] font-semibold text-slate-600">
                        <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-300 inline-block"></span>
                            <span>PA (Principal - Venda)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded bg-blue-50 border border-blue-300 inline-block"></span>
                            <span>PI (Sub-OP Intermediário)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded bg-orange-50 border border-orange-200 inline-block"></span>
                            <span>MP (Componente BOM)</span>
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                            <span>Recurso Concluído</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                            <span>Recurso Em Andamento</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
                            <span>Recurso Aguardando</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Painel Lateral de Detalhes do Nó Selecionado */}
            {selectedNodeDetails && (
                <div className="w-80 bg-white border-l border-slate-200 shadow-xl z-20 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-400" />
                            <h3 className="font-bold text-sm">Detalhes do Componente</h3>
                        </div>
                        <button 
                            onClick={() => setSelectedNodeDetails(null)}
                            className="text-slate-400 hover:text-white transition-colors animate-spin-once"
                        >
                            <Plus className="w-4 h-4 rotate-45" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 animate-fade-in">
                        {/* Identificação */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Produto</div>
                            <div className="font-bold text-slate-950 text-sm mt-0.5">{selectedNodeDetails.produto || selectedNodeDetails.codigo}</div>
                            <div className="text-xs text-slate-600 mt-1">{selectedNodeDetails.desc_produto || selectedNodeDetails.descricao}</div>
                        </div>

                        {/* Dados da OP (se houver) */}
                        {selectedNodeDetails.op && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase">Nº Ordem</div>
                                        <div className="font-bold text-slate-800 text-xs mt-0.5">
                                            {selectedNodeDetails.op}{selectedNodeDetails.item_op}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                        <div className="text-[9px] text-slate-400 font-bold uppercase">Status OP</div>
                                        <div className="font-bold text-slate-800 text-xs mt-0.5 uppercase">
                                            {selectedNodeDetails.status === 'done' ? 'Concluída' : selectedNodeDetails.status === 'in_progress' ? 'Em Andamento' : 'Aguardando'}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Saldos de Produção</div>
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="text-slate-500">Qtd Planejada:</span>
                                        <span className="font-bold text-slate-800">{selectedNodeDetails.qtde}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="text-slate-500">Qtd Produzida:</span>
                                        <span className="font-bold text-green-600">{selectedNodeDetails.qtde_feita}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Qtd Saldo:</span>
                                        <span className="font-bold text-blue-600">{selectedNodeDetails.qtde_pendente}</span>
                                    </div>
                                </div>

                                {/* Roteiro/Operações Detalhado com Data Planejada de Início */}
                                <div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <Wrench className="w-3 h-3" /> Roteiro de Operações
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {selectedNodeDetails?.recursos && (() => {
                                            const uniqueRecursos = selectedNodeDetails.recursos.filter((r, idx, arr) => 
                                                arr.findIndex(x => String(x.operac).trim() === String(r.operac).trim()) === idx
                                            );
                                            return uniqueRecursos.map((r, rIdx) => (
                                                <div key={`${r.operac}_${r.recurso}_${rIdx}`} className="border border-slate-100 p-2 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono text-xs font-bold text-slate-700">Op {r.operac}</span>
                                                    <span className={`w-2 h-2 rounded-full ${r.status === 'done' ? 'bg-green-500' : r.status === 'in_progress' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
                                                </div>
                                                <div className="text-xs text-slate-900 font-bold mt-1">{r.recurso} — {r.desc_recurso}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">Setor / Recurso: {r.recurso}</div>
                                                
                                                {/* DATA PLANEJADA INÍCIO */}
                                                {r.data_planejada_inicio && (
                                                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded w-fit">
                                                        <Calendar className="w-3 h-3 text-blue-600" />
                                                        Início Plan: {fmtDate(r.data_planejada_inicio)}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 border-t border-slate-200/50 pt-1.5">
                                                    <span>Progresso: {r.pct}%</span>
                                                    <span className="font-semibold text-slate-700">{r.qtde_produzida} / {r.qtde_planejada}</span>
                                                </div>
                                                
                                                <button
                                                    onClick={() => onApontar(selectedNodeDetails, r)}
                                                    className="interactive-el w-full mt-2 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded py-1 text-[10px] font-bold tracking-wide uppercase transition-colors"
                                                >
                                                    <Play className="w-2.5 h-2.5 fill-current" /> Apontar
                                                </button>
                                            </div>
                                        ));
                                    })()}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Seção de Romaneios / Retornos de Terceiros no Painel Lateral */}
                        {selectedNodeDetails.romaneios && selectedNodeDetails.romaneios.length > 0 && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-blue-600" /> Logística / Romaneios de Terceiros
                                </div>
                                <div className="flex flex-col gap-2">
                                    {selectedNodeDetails.romaneios.map((rom, rIdx) => {
                                        const isRec = rom.status_retorno === 'recebido';
                                        const isParc = rom.status_retorno === 'parcial';
                                        return (
                                            <div key={rIdx} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-xs text-slate-900">Romaneio #{rom.romaneio_id}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        isRec ? 'bg-emerald-100 text-emerald-800' : isParc ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-900'
                                                    }`}>
                                                        {isRec ? '100% Retornado' : isParc ? 'Retorno Parcial' : 'No Terceiro'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-semibold text-slate-700 mt-1">{rom.fornecedor_nome || 'Terceiro'}</div>
                                                {rom.romaneio_tipo && (
                                                    <div className="text-[10px] text-slate-400 font-medium">{rom.romaneio_tipo}</div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 mt-2 border-t border-slate-100 pt-1.5">
                                                    <div>
                                                        <span className="text-slate-400 block">Enviado:</span>
                                                        <span className="font-bold text-slate-800">{rom.quantidade_enviada} PC</span>
                                                        <span className="text-[9px] text-slate-400 block">{fmtDate(rom.data_liberacao)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 block">Recebido / Retorno:</span>
                                                        <span className={`font-bold ${isRec ? 'text-emerald-700' : isParc ? 'text-blue-700' : 'text-amber-700'}`}>
                                                            {rom.quantidade_recebida} PC
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 block">
                                                            {rom.data_ultimo_recebimento ? fmtDate(rom.data_ultimo_recebimento) : (rom.data_previsao_retorno ? `Prev: ${fmtDate(rom.data_previsao_retorno)}` : 'Pendente')}
                                                        </span>
                                                    </div>
                                                </div>
                                                {rom.saldo_pendente > 0 && (
                                                    <div className="mt-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex justify-between">
                                                        <span>Saldo a Retornar:</span>
                                                        <span>{rom.saldo_pendente} PC</span>
                                                    </div>
                                                )}
                                                {rom.nf_saida && (
                                                    <div className="mt-1 text-[9px] text-slate-400">
                                                        NF Remessa: <span className="font-mono font-medium text-slate-600">{rom.nf_saida}</span>
                                                        {rom.nf_retorno && <> | NF Retorno: <span className="font-mono font-medium text-slate-600">{rom.nf_retorno}</span></>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Dados de MP */}
                        {!selectedNodeDetails.op && (
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Detalhes Insumo</div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-slate-500">Quantidade Necessária:</span>
                                    <span className="font-bold text-slate-800">{selectedNodeDetails.qtde_total} {selectedNodeDetails.um}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Unidade de Medida:</span>
                                    <span className="font-bold text-slate-800 uppercase">{selectedNodeDetails.um}</span>
                                </div>
                                <div className="mt-4 text-[10px] text-slate-400 italic">
                                    Matéria-prima consumida na estrutura da Ordem de Produção pai.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Detalhamento de Múltiplos Romaneios */}
            <ItemRomaneiosModal
                isOpen={!!romaneiosModalData}
                onClose={() => setRomaneiosModalData(null)}
                itemData={romaneiosModalData}
            />
        </div>
    );
}
