import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import * as htmlToImage from 'html-to-image';
import { 
    Plus, Minus, RefreshCw, Move, Wrench, Play, Eye, Calendar,
    ArrowRight, Settings, Search, FileText, Package, Target, Maximize2, Camera
} from 'lucide-react';

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

export default function ProcessFlowchart({ 
    data, 
    onApontar, 
    onViewDrawing,
    onSelectMaterial,
    activeRootKey,
    setActiveRootKey
}) {
    const [zoom, setZoom] = useState(0.85);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
    const dragDistance = useRef(0);
    const containerRef = useRef(null);

    // Mapeia todas as OPs raízes do primeiro pedido
    const rootItens = data?.pedidos?.[0]?.treeItens || [];
    const [searchOp, setSearchOp] = useState('');

    // Define a OP raiz ativa por padrão no início ou quando o filtro de busca lateral é aplicado
    useEffect(() => {
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
            if (!isStillPresent) {
                const first = filtered[0];
                setActiveRootKey(`${first.op}_${first.item_op}_${first.sequen}`);
            }
        }
    }, [searchOp, rootItens, activeRootKey, setActiveRootKey]);

    const contentRef = useRef(null);

    // Ajusta o zoom e posição para enquadrar todo o fluxograma na tela de uma só vez
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

    // Captura a imagem do fluxograma em ultra-definição nítida nativa via html-to-image e copia para o WhatsApp (Ctrl+V)
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
                backgroundColor: '#f8fafc',
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
                    backgroundColor: '#f8fafc'
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
                    a.download = `fluxograma-processos.png`;
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
                a.download = `fluxograma-processos.png`;
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

    // Resetar visualização
    const handleReset = () => {
        setZoom(0.85);
        setPan({ x: 0, y: 0 });
    };

    // Centraliza ao mudar o Foco OP
    useEffect(() => {
        handleReset();
    }, [activeRootKey]);

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
            if (e.target.closest('.overflow-y-auto')) return;
            e.preventDefault();
            const factor = 0.08;
            setZoom(prevZoom => {
                let newZoom = prevZoom + (e.deltaY < 0 ? factor : -factor);
                return Math.max(0.15, Math.min(2.5, newZoom));
            });
        };

        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleNativeWheel);
    }, []);

    const handleZoomIn = () => setZoom(z => Math.min(2.5, z + 0.15));
    const handleZoomOut = () => setZoom(z => Math.max(0.15, z - 0.15));

    // Cores de status de operação
    const getOpStatusColor = (status) => {
        if (status === 'done') return 'bg-green-500 text-white ring-green-600/30';
        if (status === 'in_progress') return 'bg-blue-500 text-white ring-blue-600/30 animate-pulse';
        return 'bg-slate-300 text-slate-700 ring-slate-400/20';
    };

    // ─── Processar Dados para o Fluxograma ──────────────────────────────────
    // Precisamos percorrer a árvore toda e agrupar os itens por Recurso (Setor).
    const processFlow = useMemo(() => {
        try {
            const resourcesMap = new Map();

            const traverse = (item) => {
                if (!item.op) return;
                
                if (item.recursos && item.recursos.length > 0) {
                    item.recursos.forEach(r => {
                        const resKey = r.recurso;
                        if (!resourcesMap.has(resKey)) {
                            resourcesMap.set(resKey, {
                                codigo: resKey,
                                descricao: r.desc_recurso,
                                minOpCode: parseInt(r.operac, 10) || 999,
                                items: []
                            });
                        }
                        const resEntry = resourcesMap.get(resKey);
                        
                        const opCodeInt = parseInt(r.operac, 10) || 999;
                        if (opCodeInt < resEntry.minOpCode) {
                            resEntry.minOpCode = opCodeInt;
                        }

                        if (!resEntry.items.some(existing => existing.item.op === item.op && existing.item.item_op === item.item_op && existing.item.sequen === item.sequen)) {
                            resEntry.items.push({
                                item: item,
                                opDetail: r
                            });
                        }
                    });
                }

                if (item.subItens && item.subItens.length > 0) {
                    item.subItens.forEach(sub => traverse(sub));
                }
            };

            const targetRoots = activeRootKey === 'all' 
                ? rootItens 
                : rootItens.filter(r => `${r.op}_${r.item_op}_${r.sequen}` === activeRootKey);

            targetRoots.forEach(root => traverse(root));

            const resourcesArray = Array.from(resourcesMap.values());
            resourcesArray.sort((a, b) => a.minOpCode - b.minOpCode);

            resourcesArray.forEach(res => {
                res.items.sort((a, b) => {
                    const statusOrder = { 'in_progress': 1, 'waiting': 2, 'done': 3 };
                    const s1 = statusOrder[a.opDetail.status] || 9;
                    const s2 = statusOrder[b.opDetail.status] || 9;
                    if (s1 !== s2) return s1 - s2;
                    const pA = a.item?.produto || '';
                    const pB = b.item?.produto || '';
                    return pA.localeCompare(pB);
                });
            });

            return resourcesArray;
        } catch (e) {
            console.error("Error generating process flow:", e);
            return [];
        }
    }, [rootItens, activeRootKey]);

    return (
        <div className="flex-1 flex overflow-hidden relative bg-slate-50 rounded-b-xl border border-slate-200 select-none w-full h-full min-h-[500px]">
            {/* Canvas Principal Interativo */}
            <div 
                ref={containerRef}
                className="flex-1 w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing bg-slate-50"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div 
                    ref={contentRef}
                    data-flowchart-content="true"
                    className="absolute"
                    style={{
                        top: '50px',
                        left: '50px',
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'top left',
                        transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '40px',
                        padding: '20px'
                    }}
                >
                    {processFlow.length > 0 ? (
                        processFlow.map((resource, index) => (
                            <React.Fragment key={resource.codigo}>
                                {/* Cartão do Recurso (Setor) */}
                                <div className="flex flex-col items-center">
                                    <div className="bg-slate-800 border-2 border-slate-700 text-white rounded-xl p-4 shadow-xl w-72 relative z-10 flex flex-col items-center mb-6">
                                        <div className="absolute -top-3 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            Setor Produtivo
                                        </div>
                                        <Settings className="w-8 h-8 text-blue-400 mb-2 opacity-80" />
                                        <h2 className="text-sm font-bold text-center uppercase tracking-wide leading-tight">
                                            {resource.descricao}
                                        </h2>
                                        <div className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-900/50 px-2 py-0.5 rounded">
                                            Cód: {resource.codigo}
                                        </div>
                                        <div className="mt-3 flex items-center justify-center bg-slate-700/50 w-full rounded py-1.5 border border-slate-600/50">
                                            <span className="text-[10px] font-semibold text-slate-300">
                                                {resource.items.length} OPs na Fila
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lista de OPs debaixo deste Recurso */}
                                    <div className="flex flex-col gap-3 w-64 relative before:content-[''] before:absolute before:w-1 before:bg-slate-200 before:top-[-24px] before:bottom-0 before:left-1/2 before:-translate-x-1/2 before:-z-10">
                                        {resource.items.map((opObj, iIdx) => {
                                            const { item, opDetail } = opObj;
                                            return (
                                                <div 
                                                    key={`${item.op}_${item.item_op}_${item.sequen}_${opDetail.operac}`}
                                                    onClick={() => setSelectedNodeDetails(item)}
                                                    className={`interactive-el bg-white border-8 p-3 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 ${
                                                        opDetail.status === 'done' ? 'border-green-400' :
                                                        opDetail.status === 'in_progress' ? 'border-blue-400 ring-2 ring-blue-100' :
                                                        'border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${getOpStatusColor(opDetail.status)}`}></div>
                                                            <span className="font-mono text-[9px] font-bold text-slate-500">
                                                                OP {item.op}{item.item_op}{item.sequen}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                                            Op {opDetail.operac}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center mt-1 mb-2">
                                                        <div className="font-bold text-slate-800 text-xs truncate" title={item.produto}>
                                                            {item.produto}
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onViewDrawing(item.produto); }}
                                                            className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                                                                item.has_pdf ? 'text-red-500 bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'text-slate-400 hover:text-blue-500'
                                                            }`}
                                                            title={item.has_pdf ? "Visualizar Desenho Técnico (PDF disponível)" : "Visualizar Desenho Técnico (PDF não disponível)"}
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="text-[9px] text-slate-500 truncate mb-2" title={item.desc_produto}>
                                                        {item.desc_produto}
                                                    </div>

                                                    <div className="flex justify-between items-end border-t border-slate-100 pt-2 mt-1">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[9px] text-slate-400 font-semibold">Progresso OP</span>
                                                            <span className="text-[10px] font-bold text-slate-700">
                                                                {opDetail.qtde_produzida} / {opDetail.qtde_planejada}
                                                            </span>
                                                        </div>
                                                        
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onApontar(item, opDetail); }}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold transition-colors ${
                                                                opDetail.status === 'done' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                                                opDetail.status === 'in_progress' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' :
                                                                'bg-slate-800 text-white hover:bg-slate-900 shadow-sm'
                                                            }`}
                                                        >
                                                            {opDetail.status === 'done' ? 'Visualizar' : <><Play className="w-2.5 h-2.5 fill-current" /> Apontar</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Seta conectando recursos (menos para o último) */}
                                {index < processFlow.length - 1 && (
                                    <div className="flex items-center h-24 mt-4">
                                        <div className="h-1 bg-slate-300 w-12 relative">
                                            <ArrowRight className="w-5 h-5 text-slate-400 absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-50 rounded-full" />
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))
                    ) : (
                        <div className="text-slate-400 text-center pointer-events-none select-none mt-20">
                            <Move className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-semibold">Nenhum fluxo de processo gerado</p>
                        </div>
                    )}
                </div>

                {/* Grid Vertical de Foco na OP (Múltiplas OPs) */}
                {rootItens.length > 1 && (
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
                            <button 
                                onClick={() => setActiveRootKey('all')}
                                className={`text-left px-3 py-2.5 rounded-lg transition-all border interactive-el ${
                                    activeRootKey === 'all'
                                    ? 'bg-red-50/50 border-red-500 text-red-950 shadow-md ring-2 ring-red-100 transform -translate-y-px font-semibold' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-red-300 hover:bg-white'
                                }`}
                            >
                                <div className="font-bold text-xs">Visão Geral (Todas)</div>
                                <div className="text-[9px] mt-0.5 opacity-80">Unir fluxo do pedido inteiro</div>
                            </button>
                            
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
                <div className="absolute bottom-10 right-20 flex flex-col gap-2 z-20">
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
                        title="Ajustar Fluxograma à Tela (Ver tudo de uma só vez)"
                    >
                        <Maximize2 className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleCopyScreenshot}
                        className="bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-colors font-bold interactive-el"
                        title="Copiar Print do Fluxograma para WhatsApp (Ctrl+V)"
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
            </div>

            {/* Painel Lateral de Detalhes do Nó Selecionado */}
            {selectedNodeDetails && (
                <div className="w-80 bg-white border-l border-slate-200 shadow-xl z-20 flex flex-col overflow-hidden">
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-400" />
                            <h3 className="font-bold text-sm">Detalhes da Ordem</h3>
                        </div>
                        <button 
                            onClick={() => setSelectedNodeDetails(null)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <Plus className="w-4 h-4 rotate-45" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Produto</div>
                            <div className="font-bold text-slate-950 text-sm mt-0.5">{selectedNodeDetails.produto}</div>
                            <div className="text-xs text-slate-600 mt-1">{selectedNodeDetails.desc_produto}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Nº Ordem</div>
                                <div className="font-bold text-slate-800 text-xs mt-0.5">
                                    {selectedNodeDetails.op}{selectedNodeDetails.item_op}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Status Global</div>
                                <div className="font-bold text-slate-800 text-xs mt-0.5 uppercase">
                                    {selectedNodeDetails.status === 'done' ? 'Concluída' : selectedNodeDetails.status === 'in_progress' ? 'Em Andamento' : 'Aguardando'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Wrench className="w-3 h-3" /> Todas as Operações da Peça
                            </div>
                            <div className="flex flex-col gap-2">
                                {selectedNodeDetails.recursos && selectedNodeDetails.recursos.map(r => (
                                    <div key={r.operac} className="border border-slate-100 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-xs font-bold text-slate-700">Op {r.operac}</span>
                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                r.status === 'done' ? 'bg-green-100 text-green-700' :
                                                r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                                {r.status === 'done' ? 'Concluído' : r.status === 'in_progress' ? 'Andamento' : 'Fila'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-800 font-semibold mt-1">{r.desc_recurso}</div>
                                        <div className="text-[10px] text-slate-500">Recurso: {r.recurso}</div>
                                        
                                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 border-t border-slate-200/50 pt-1.5">
                                            <span>Progresso: {r.pct}%</span>
                                            <span className="font-semibold text-slate-700">{r.qtde_produzida} / {r.qtde_planejada}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
