import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Calendar, FileText, Settings, Layers, Package,
    StickyNote, MoreVertical, Loader2, Truck,
    Factory, ClipboardList, ImageIcon, FileSpreadsheet, AlertTriangle, Award, Boxes, Trash2,
    Bot, Scissors, Lock, Printer, History
} from 'lucide-react';
import ItemStatusBadge from './ItemStatusBadge';
import { getFileUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { BillingForecastInput } from './BillingForecastInput';
import { getColumnWidthStyle } from './ColumnSettingsPanel';

// Colunas com balão flutuante (tooltip) não cortam o conteúdo ao aplicar a largura salva pelo usuário
const TOOLTIP_COLUMNS = new Set(['tipo', 'status', 'qtd_entreg']);

const withCellWidth = (col, td) => {
    const style = getColumnWidthStyle(col, !TOOLTIP_COLUMNS.has(col.key));
    if (!td || !style) return td;
    return React.cloneElement(td, { style: { ...(td.props.style || {}), ...style } });
};

/**
 * Memoized flat-view table row. Receives all data and callbacks as props.
 * Only re-renders when pedido, item, or PCP forecast fields change.
 */
const FlatItemRow = ({
    visibleColumns,
    item,
    index,
    locationPathname,
    isSelected,
    isActive,
    printingOrderId,
    openActionMenu,
    menuPosition,
    // callbacks
    onSelectItem,
    onSetActiveRow,
    onOpenDocs,
    onSetEngineeringTarget,
    onSetPcpForecastTarget,
    onSetNotesTarget,
    onSetPriorityTarget,
    onSetInvoiceModal,
    onOpenActionMenu,
    formatProtheusDate,
    onPrintOPMirror,
    onPrintFichas,
    onPrintOPByOperation,
    onPrintOPByOperationWithDrawings,
    onPrintOPByResourceWithDrawings,
    onPrintOPWithOpsStampWithDrawings,
    onPrintOPWithOpsStampDrawingsByResource,
    onPrintOPWithOpsStampWithDescDrawings,
    onPrintOPWithOpsStampWithDescDrawingsByResource,
    onExportOPByOperationExcel,
    onSetMenuPosition,
    onUpdateFaturamentoDate,
    onOpenClassificacaoModal,
    onOpenBomStructure,
    onOpenStructureStock,
    onExcluirOp,
    // frações e lotes LPF
    onSplitOp,
    onUnifyOp,
    onSmartPlanOp,
    onOpenManageLot,
    onRemoveFromLot,
    onReprintLot,
    onDissolveLot,
    onReleaseProduction,
    onCorteForecast,
    onOpenHistorico,
    canEdit,
}) => {
    const { user } = useAuth();
    const handleNfClick = useCallback((nf) => {
        onSetInvoiceModal({ nf, item });
    }, [item, onSetInvoiceModal]);

    const hasOp = item.op_num && item.op_num.trim() !== '' && item.op_num !== '-';

    const opTypeLabel = item.op_tipo === 'F' ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded shadow-sm border border-emerald-200" title="OP Firme">F</span>
    ) : item.op_tipo === 'P' ? (
        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded shadow-sm border border-orange-200" title="OP Prevista">P</span>
    ) : null;

    const tipoConfig = {
        Novo: { label: 'NOVO', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
        'Revisão': { label: 'REVISÃO', bg: 'bg-orange-100 text-orange-700 border-orange-200' },
        'Restrição': { label: 'RESTRIÇÃO', bg: 'bg-red-100 text-red-700 border-red-200' },
    };
    const tipoCfg = tipoConfig[item.status_tipo_item] || { label: 'PCP', bg: 'bg-gray-100 text-gray-700 border-gray-200' };

    // Frações do mesmo item compartilham pedido/item: a linha é identificada pela fração
    const rowKey = item.fraction_id ?? `${item.pedido}-${item.item}`;
    const menuKey = `flat-${rowKey}`;
    const isMenuOpen = openActionMenu === menuKey;
    const isFraction = !!item.is_fraction;

    const romaneios = item.romaneios || [];
    const totalRomaneio = romaneios.reduce((acc, r) => acc + Number(r.quantidade), 0);

    // Helper to get formatted OP (number + item)
    const getDisplayOp = (op, itemNumber) => {
        if (!op || String(op).trim() === '-') return op;
        let cleanOp = String(op).trim();
        if (cleanOp.length === 6 && itemNumber && String(itemNumber).trim() !== '-') {
            return cleanOp + String(itemNumber).trim().padStart(2, '0');
        }
        return cleanOp;
    };

    const getPriorityColors = (prioridade) => {
        if (!prioridade || prioridade <= 0) return null;
        switch (Number(prioridade)) {
            case 1: return { bg: 'bg-red-50/80', hover: 'hover:bg-red-100/90', border: 'border-l-red-500', ring: 'ring-red-200', textMain: 'text-red-700', badgeBg: 'bg-red-100/80', badgeBorder: 'border-red-200', badgeText: 'text-red-600', icon: 'text-red-600', label: 'MÁXIMA' };
            case 2: return { bg: 'bg-orange-50/80', hover: 'hover:bg-orange-100/90', border: 'border-l-orange-500', ring: 'ring-orange-200', textMain: 'text-orange-700', badgeBg: 'bg-orange-100/80', badgeBorder: 'border-orange-200', badgeText: 'text-orange-600', icon: 'text-orange-600', label: 'ALTA' };
            case 3: return { bg: 'bg-yellow-50/80', hover: 'hover:bg-yellow-100/90', border: 'border-l-yellow-500', ring: 'ring-yellow-200', textMain: 'text-yellow-700', badgeBg: 'bg-yellow-100/80', badgeBorder: 'border-yellow-200', badgeText: 'text-yellow-600', icon: 'text-yellow-600', label: 'MÉDIA' };
            case 4: return { bg: 'bg-purple-50/80', hover: 'hover:bg-purple-100/90', border: 'border-l-purple-500', ring: 'ring-purple-200', textMain: 'text-purple-700', badgeBg: 'bg-purple-100/80', badgeBorder: 'border-purple-200', badgeText: 'text-purple-600', icon: 'text-purple-600', label: 'NORMAL' };
            default: return { bg: 'bg-red-50/80', hover: 'hover:bg-red-100/90', border: 'border-l-red-500', ring: 'ring-red-200', textMain: 'text-red-700', badgeBg: 'bg-red-100/80', badgeBorder: 'border-red-200', badgeText: 'text-red-600', icon: 'text-red-600', label: 'PRIOR.' };
        }
    };

    const pColors = getPriorityColors(item.op_prioridade);

    return (
        <tr
            onClick={() => onSetActiveRow && onSetActiveRow(isActive ? null : rowKey)}
            className={`transition-colors cursor-pointer border-b border-gray-50 last:border-0 ${
                pColors
                    ? `${pColors.bg} ${pColors.hover} border-l-4 ${pColors.border} ring-1 ring-inset ${pColors.ring} shadow-sm`
                    : isFraction
                        ? 'bg-amber-50/40 hover:bg-amber-100/50'
                        : parseFloat(item.qtd_faturar) <= 0
                            ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80'
                            : 'bg-white hover:bg-slate-50'
            } ${isActive ? '!bg-indigo-50/80 shadow-sm ring-1 ring-indigo-200' : (isSelected ? '!bg-blue-50' : '')}`}
        >
{visibleColumns.map(col => withCellWidth(col, (() => {
                switch(col.key) {
                    case 'checkbox': return (
                        <td key={col.key} className="px-2 py-2 text-center sticky left-0 z-10 bg-inherit min-w-[40px] max-w-[40px] w-[40px]" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label="Selecionar Item" checked={isSelected} onChange={() => onSelectItem(item)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                        </td>
                    );
                    case 'pedido': return (
                        <td key={col.key} className="px-3 py-2 whitespace-nowrap sticky left-[40px] z-10 bg-inherit min-w-[90px] max-w-[90px] w-[90px]">
                            <div className="flex flex-col gap-0.5">
                                <span className={`font-bold ${pColors ? pColors.textMain : 'text-gray-900'}`}>{item.pedido}</span>
                                {isFraction && (
                                    <span className="px-1 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 w-fit" title={`Fração ${item.fraction_letter} de ${item.total_fractions} — ${item.visual_qtd} un.`}>
                                        Fração {item.fraction_letter}
                                    </span>
                                )}
                                {pColors && (
                                    <div className={`flex items-center gap-1 text-[10px] font-bold ${pColors.badgeText} ${pColors.badgeBg} px-1 rounded shadow-sm border ${pColors.badgeBorder} w-fit`} title={item.priority_obs || `Prioridade ${pColors.label}`}>
                                        <AlertTriangle className={`h-3 w-3 ${pColors.icon}`} />
                                        <span>G{item.op_prioridade}</span>
                                    </div>
                                )}
                            </div>
                        </td>
                    );
                    case 'lote_lpf': return (
                        <td key={col.key} className="px-3 py-2 text-center whitespace-nowrap min-w-[110px]">
                            {item.lpf_codigo ? (
                                <span
                                    className="inline-flex items-center gap-1 font-mono font-black text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md"
                                    title={`Item no Lote de Fabricação (LPF): ${item.lpf_codigo}`}
                                >
                                    <Lock className="w-3 h-3 text-emerald-700" />
                                    {item.lpf_codigo}
                                </span>
                            ) : (
                                <span className="text-gray-300 text-xs italic" title="Item disponível (sem lote)">—</span>
                            )}
                        </td>
                    );
                    case 'emissao': return (
                        <td key={col.key} className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap bg-inherit min-w-[90px] max-w-[90px] w-[90px]">
                            <div className="flex items-center justify-center gap-1"><Calendar className="h-3 w-3 text-gray-400" />{formatProtheusDate(item.emissao)}</div>
                        </td>
                    );
                    case 'ref_cliente': return (
                        <td key={col.key} className="px-3 py-2 text-xs font-mono text-gray-600 bg-inherit min-w-[100px] max-w-[100px] w-[100px] truncate">
                            {item.ref_cliente || '-'}
                        </td>
                    );
                    case 'cliente': return (
                        <td key={col.key} className="px-3 py-2 bg-inherit min-w-[150px] max-w-[150px] w-[150px]">
                            <div className="text-xs font-medium text-gray-700 truncate" title={item.nome_cliente}>{item.nome_cliente}</div>
                        </td>
                    );
                    case 'pc': return (
                        <td key={col.key} className="px-3 py-2 text-xs text-gray-600 bg-inherit min-w-[90px] max-w-[90px] w-[90px] truncate">
                            {item.ped_cliente || '-'}
                        </td>
                    );
                    case 'item': return (
                        <td key={col.key} className="px-4 py-2 text-center text-gray-900 min-w-[40px] max-w-[40px] w-[40px]">
                            <div className="flex items-center justify-center gap-1">
                                {item.item}
                                {['Jits', 'PPAP', 'Jits e PPAP'].includes(item.classificacao) && (
                                    <Award className="h-3 w-3 text-purple-600 flex-shrink-0" title={`Classificação: ${item.classificacao}`} />
                                )}
                            </div>
                        </td>
                    );
                    case 'op': return (
                        <td key={col.key} className="px-3 py-2 text-center bg-inherit min-w-[175px] w-[175px] whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                                <span
                                    className={`px-1.5 py-0.5 rounded text-xs font-mono ${isFraction ? 'bg-amber-100/90 text-amber-950 font-bold border border-amber-400' : item.op_tipo === 'F' ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200' : 'bg-blue-50 text-blue-700 font-medium'} ${hasOp && onOpenBomStructure ? 'cursor-pointer hover:underline' : ''}`}
                                    title={hasOp ? 'Ver estrutura da OP' : undefined}
                                    onClick={hasOp && onOpenBomStructure ? (e) => { e.stopPropagation(); onOpenBomStructure(item.op_num, item.item, item.pedido, item.codigo); } : undefined}
                                >
                                    {(isFraction ? item.visual_op : getDisplayOp(item.op_num, item.item)) || '-'}
                                </span>
                                {hasOp && opTypeLabel}
                                {hasOp && canEdit && onSplitOp && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onSplitOp(item); }}
                                        className="p-1 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                        title={isFraction ? 'Reajustar Frações da OP' : 'Partir / Fracionar OP'}
                                    >
                                        <Scissors className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </td>
                    );
                    case 'codigo': return (
                        <td key={col.key} className="px-3 py-2 font-mono text-xs whitespace-nowrap bg-inherit min-w-[140px] max-w-[140px] w-[140px] truncate">
                            <Link to={`/estrutura/${encodeURIComponent(item.codigo)}?pedido=${encodeURIComponent(item.pedido || '')}&item=${encodeURIComponent(item.item || '')}`} state={{ from: locationPathname, pedido: item.pedido, item: item.item }} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                                {item.codigo} <Layers className="h-3 w-3" />
                            </Link>
                        </td>
                    );
                    case 'c6_xrevm': return (
                        <td key={col.key} className="px-4 py-2 text-center text-xs text-gray-500 font-mono">
                            {item.rev_codigo || '-'}
                        </td>
                    );
                    case 'rev_cliente': return (
                        <td key={col.key} className="px-4 py-2 font-mono text-xs text-gray-500 text-center">
                            {item.c6_rev_cliente || '-'}
                        </td>
                    );
                    case 'acoes': return (
                        <td key={col.key} className="px-4 py-2 text-center print:hidden min-w-[120px]">
                            <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { if (item.has_drawing && item.drawing_url) { window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`), '_blank'); } else if (item.docs_count === 1 && item.first_doc) { window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.first_doc)}`), '_blank'); } else { onOpenDocs(item.codigo, item.descricao); } }} className={`p-1.5 rounded-lg transition-all relative ${item.has_docs ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`} title={item.has_docs ? `${item.docs_count} Documento(s) - Clique para abrir` : 'Documentos'}>
                                    <FileText className="h-4 w-4" />
                                    {item.has_docs && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" /></span>}
                                </button>
                                <button
                                    onClick={() => onOpenStructureStock && onOpenStructureStock({
                                        productCode: item.codigo,
                                        productDesc: item.descricao,
                                        orderNum: item.pedido,
                                        orderItem: item.item,
                                        orderQty: item.qtd_faturar || item.c6_qtdven || item.qtd_pedida,
                                        clientName: item.cliente_nome || item.cliente
                                    })}
                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 transition-all bg-emerald-50 hover:bg-emerald-100 rounded flex items-center justify-center cursor-pointer"
                                    title="Consultar Estoque da Estrutura (Fábrica + Protheus)"
                                >
                                    <Boxes className="h-4 w-4" />
                                </button>
                                {canEdit && (
                                    <button onClick={() => onSetEngineeringTarget({ orderId: item.pedido, item })} className="p-1.5 text-gray-400 hover:text-blue-500 transition-all bg-gray-50/50 hover:bg-blue-50 rounded flex items-center justify-center" title="Controle Engenharia / BOM">
                                        <Settings className="h-4 w-4" />
                                    </button>
                                )}
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                    <button title="Mais ações" onClick={(e) => { e.stopPropagation(); if (isMenuOpen) { onOpenActionMenu(null); } else { const rect = e.currentTarget.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; const spaceAbove = rect.top; const menuHeight = 350; if (spaceBelow < menuHeight && spaceAbove > spaceBelow) { onSetMenuPosition({ top: undefined, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); } else { onSetMenuPosition({ top: rect.bottom + 4, bottom: undefined, right: window.innerWidth - rect.right }); } onOpenActionMenu(menuKey); } }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer">
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                    {isMenuOpen && (
                                        <div data-action-menu className="fixed z-[9999] bg-white rounded-lg border border-gray-200 shadow-xl py-1 min-w-[220px] overflow-y-auto" style={{ top: menuPosition?.top !== undefined ? `${menuPosition.top}px` : 'auto', bottom: menuPosition?.bottom !== undefined ? `${menuPosition.bottom}px` : 'auto', right: `${menuPosition?.right}px`, maxHeight: `calc(100vh - ${(menuPosition?.top ?? menuPosition?.bottom ?? 0) + 8}px)` }}>
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (onOpenStructureStock) {
                                                        onOpenStructureStock({
                                                            productCode: item.codigo,
                                                            productDesc: item.descricao,
                                                            orderNum: item.pedido,
                                                            orderItem: item.item,
                                                            orderQty: item.qtd_faturar || item.c6_qtdven || item.qtd_pedida,
                                                            clientName: item.cliente_nome || item.cliente
                                                        });
                                                    }
                                                    onOpenActionMenu(null); 
                                                }} 
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 font-bold transition-colors"
                                            >
                                                <Boxes className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                                                <span>Estoque da Estrutura (BOM)</span>
                                            </button>
                                            <div className="border-t border-gray-100 my-1" />
                                            <button onClick={(e) => { e.stopPropagation(); onSetPriorityTarget({ pedido: item.pedido, item: item.item, codigo: item.codigo, op_num_completa: item.op_num_completa || item.op_num }, 'faturamento'); onOpenActionMenu(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors">
                                                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                                                <span>Prioridade Faturamento</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onSetPriorityTarget({ pedido: item.pedido, item: item.item, codigo: item.codigo, op_num_completa: item.op_num_completa || item.op_num }, 'op'); onOpenActionMenu(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-rose-50 hover:text-rose-800 transition-colors">
                                                <Factory className="h-4 w-4 flex-shrink-0 text-rose-700" />
                                                <span>Prioridade de OP</span>
                                            </button>
                                            <div className="border-t border-gray-100 my-1" />
                                            <div className="px-3 py-1 text-[10px] font-bold text-indigo-800 bg-indigo-50/70 uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers size={12} className="text-indigo-600" />
                                                <span>Fração e Lote LPF</span>
                                                {isFraction && <span className="ml-auto normal-case text-amber-800">Fração {item.fraction_letter} · {item.visual_qtd} un.</span>}
                                            </div>
                                            {onOpenHistorico && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onOpenHistorico(item); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                                                    <History className="h-4 w-4 flex-shrink-0 text-slate-500" />
                                                    <span>Histórico da OP</span>
                                                </button>
                                            )}
                                            {hasOp && onSmartPlanOp && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onSmartPlanOp(item); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-900 hover:bg-indigo-50 transition-colors">
                                                    <Bot className="h-4 w-4 flex-shrink-0 text-indigo-600" />
                                                    <span>Agente: Planejamento Inteligente (esta OP)</span>
                                                </button>
                                            )}
                                            {hasOp && canEdit && onSplitOp && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onSplitOp(item); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-slate-100 transition-colors">
                                                    <Scissors className="h-4 w-4 flex-shrink-0 text-slate-500" />
                                                    <span>Partir / Fracionar OP</span>
                                                </button>
                                            )}
                                            {isFraction && canEdit && onUnifyOp && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onUnifyOp(item); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
                                                    <Trash2 className="h-4 w-4 flex-shrink-0 text-rose-500" />
                                                    <span>Unificar OP (Excluir Frações)</span>
                                                </button>
                                            )}
                                            {item.lpf_codigo ? (
                                                <>
                                                    {onReprintLot && (
                                                        <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onReprintLot(item.lpf_codigo); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50 transition-colors">
                                                            <Printer className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                                                            <span>Reimprimir Pacote do Lote ({item.lpf_codigo})</span>
                                                        </button>
                                                    )}
                                                    {canEdit && onRemoveFromLot && (
                                                        <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onRemoveFromLot(item); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                                                            <Trash2 className="h-4 w-4 flex-shrink-0 text-rose-500" />
                                                            <span>Remover do Lote ({item.lpf_codigo})</span>
                                                        </button>
                                                    )}
                                                    {canEdit && onDissolveLot && (
                                                        <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onDissolveLot(item.lpf_codigo); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 transition-colors">
                                                            <Trash2 className="h-4 w-4 flex-shrink-0 text-rose-600" />
                                                            <span>Desmanchar Lote ({item.lpf_codigo})</span>
                                                        </button>
                                                    )}
                                                </>
                                            ) : (canEdit && onOpenManageLot && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onOpenManageLot([item]); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 transition-colors">
                                                    <Layers className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                                                    <span>Inserir em um Lote...</span>
                                                </button>
                                            ))}
                                            {canEdit && onReleaseProduction && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onReleaseProduction([item]); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
                                                    <Factory className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                                                    <span>Liberar Produção / Aglutinar</span>
                                                </button>
                                            )}
                                            {canEdit && onCorteForecast && (
                                                <button onClick={(e) => { e.stopPropagation(); onOpenActionMenu(null); onCorteForecast([item]); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                                                    <Scissors className="h-4 w-4 flex-shrink-0 text-amber-600" />
                                                    <span>Gerar Plano de Corte</span>
                                                </button>
                                            )}
                                            <div className="border-t border-gray-100 my-1" />
                                            <button onClick={(e) => { onPrintOPMirror(item.pedido, e, item.item, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Factory className="h-4 w-4 flex-shrink-0 text-teal-500" />} <span>Espelho OP</span>
                                            </button>
                                            <button onClick={(e) => { onPrintFichas(item.pedido, e, item.item, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `ficha-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `ficha-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ClipboardList className="h-4 w-4 flex-shrink-0 text-amber-500" />} <span>Fichas de Operação</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPByOperation(item.pedido, e, item.item, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-oper-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-oper-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Layers className="h-4 w-4 flex-shrink-0 text-blue-500" />} <span>Por Operações (PDF)</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPByOperationWithDrawings(item.pedido, e, item.item, false, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-drawings-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />} <span>OP + Desenhos (PDF)</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPByResourceWithDrawings(item.pedido, e, item.item, false, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-resource-drawings-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-resource-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-cyan-500" />} <span>OP + Desenhos (Por Recurso)</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPWithOpsStampWithDrawings(item.pedido, e, item.item, false, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-drawings-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-stamp-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />} <span>OP + Desenhos (Roteiro no Carimbo)</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPWithOpsStampDrawingsByResource(item.pedido, e, item.item, false, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-resource-drawings-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-stamp-resource-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />} <span>OP + Desenhos (Roteiro no Carimbo) - Por Recurso</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPWithOpsStampWithDescDrawings(item.pedido, e, item.item, false, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-drawings-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-stamp-desc-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-purple-500" />} <span>OP + Desenhos (Roteiro/Descrição no Carimbo)</span>
                                            </button>
                                            <button onClick={(e) => { onPrintOPWithOpsStampWithDescDrawingsByResource(item.pedido, e, item.item, false, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-resource-drawings-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-stamp-desc-resource-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-fuchsia-500" />} <span>OP + Desenhos (Roteiro/Descrição no Carimbo) - Por Recurso</span>
                                            </button>
                                            <button onClick={(e) => { onExportOPByOperationExcel(item.pedido, e, item.item, item); onOpenActionMenu(null); }} disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-excel-${item.pedido}-${item.item}`} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                {printingOrderId === `op-excel-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />} <span>Por Operações (Excel)</span>
                                            </button>
                                            <div className="border-t border-gray-100 my-1" />
                                            <div className="px-3 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50/70 uppercase tracking-wider flex items-center gap-1.5">
                                                <Boxes size={12} className="text-emerald-600" />
                                                <span>Com Estudo de Estoque</span>
                                            </div>
                                            <button 
                                                onClick={(e) => { onPrintOPByOperationWithDrawings(item.pedido, e, item.item, true, item); onOpenActionMenu(null); }} 
                                                disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-drawings-${item.pedido}-${item.item}-stock`} 
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                            >
                                                {printingOrderId === `op-drawings-${item.pedido}-${item.item}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-emerald-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-emerald-600" />} 
                                                <span>OP + Desenhos + Estoque</span>
                                            </button>
                                            <button 
                                                onClick={(e) => { onPrintOPWithOpsStampWithDescDrawings(item.pedido, e, item.item, true, item); onOpenActionMenu(null); }} 
                                                disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-drawings-${item.pedido}-${item.item}-stock`} 
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                            >
                                                {printingOrderId === `op-stamp-desc-drawings-${item.pedido}-${item.item}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-purple-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-purple-600" />} 
                                                <span>OP + Desenhos (Carimbo) + Estoque</span>
                                            </button>
                                            <button 
                                                onClick={(e) => { onPrintOPWithOpsStampWithDescDrawingsByResource(item.pedido, e, item.item, true, item); onOpenActionMenu(null); }} 
                                                disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-resource-drawings-${item.pedido}-${item.item}-stock`} 
                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                            >
                                                {printingOrderId === `op-stamp-desc-resource-drawings-${item.pedido}-${item.item}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-fuchsia-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-fuchsia-600" />} 
                                                <span>OP + Desenhos (Por Recurso) + Estoque</span>
                                            </button>
                                            {hasOp && (
                                                <>
                                                    <div className="border-t border-gray-200 my-1" />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenActionMenu(null);
                                                            if (onExcluirOp) onExcluirOp(item);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors font-semibold"
                                                    >
                                                        <Trash2 className="h-4 w-4 flex-shrink-0 text-red-500" />
                                                        <span>Excluir O.P.</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </td>
                    );
                    case 'classificacao': return (
                        <td key={col.key} className="px-4 py-2 text-center">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canEdit && onOpenClassificacaoModal) onOpenClassificacaoModal(item);
                                }}
                                className={`px-2 py-1 text-xs font-bold rounded shadow-sm border whitespace-nowrap flex items-center justify-center gap-1 mx-auto transition-colors
                                    ${!item.classificacao || item.classificacao === 'Nenhum' ? 'bg-slate-50 text-slate-500 border-slate-200 ' + (canEdit ? 'hover:bg-slate-100' : 'cursor-default') : ''}
                                    ${item.classificacao === 'Jits' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 ' + (canEdit ? 'hover:bg-indigo-100' : 'cursor-default') : ''}
                                    ${item.classificacao === 'PPAP' ? 'bg-orange-50 text-orange-700 border-orange-200 ' + (canEdit ? 'hover:bg-orange-100' : 'cursor-default') : ''}
                                    ${item.classificacao === 'Jits e PPAP' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 ' + (canEdit ? 'hover:bg-fuchsia-100' : 'cursor-default') : ''}
                                `}
                                title={canEdit ? "Clique para editar Classificação e Anexos" : "Classificação da Peça"}
                            >
                                {item.classificacao && item.classificacao !== 'Nenhum' ? item.classificacao : 'Classificar'}
                            </button>
                        </td>
                    );
                    case 'tipo': return (
                        <td key={col.key} className="px-4 py-2 text-center min-w-[80px]">
                            <div className="relative group/tipo inline-flex justify-center">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-help ${tipoCfg.bg}`}>{tipoCfg.label}</span>
                                {item.status_tipo_detalhe && (
                                    <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tipo:flex flex-col items-center">
                                        <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px] max-w-[300px]">
                                            <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Detalhes do Tipo:</div>
                                            <div className="whitespace-normal">{item.status_tipo_detalhe}</div>
                                        </div>
                                        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700" />
                                    </div>
                                )}
                            </div>
                        </td>
                    );
                    case 'descricao': return (
                        <td key={col.key} className="px-4 py-2 text-xs text-gray-600 truncate max-w-[250px]" title={item.descricao}>
                            {item.descricao}
                        </td>
                    );
                    case 'status': return (
                        <td key={col.key} className="px-4 py-2 text-center min-w-[120px]">
                            <ItemStatusBadge item={item} onNfClick={(nf) => handleNfClick(nf)} index={index} />
                        </td>
                    );
                    case 'qtd_entreg': return (
                        <td key={col.key} className="px-4 py-2 text-right text-gray-600 min-w-[80px]">
                            <div className="flex items-center justify-end gap-1.5">
                                {romaneios.length > 0 && (
                                    <div className="relative group/romaneio flex items-center">
                                        <div className={`p-1 rounded cursor-help ${totalRomaneio >= parseFloat(item.quantidade) ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                            <Truck className="h-4 w-4" />
                                        </div>
                                        <div className="absolute z-[60] bottom-full right-0 mb-2 hidden group-hover/romaneio:flex flex-col items-end">
                                            <div className="bg-slate-800 text-slate-100 text-[11px] rounded p-2.5 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[200px]">
                                                <div className="font-bold text-white mb-2 border-b border-slate-600 pb-1 flex items-center gap-2">
                                                    <Truck className="h-4 w-4 text-blue-400" /> Expedição (Romaneios)
                                                </div>
                                                <div className="max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {romaneios.map(r => (
                                                        <div key={r.romaneio_id} className="flex justify-between py-1 border-b border-slate-700/50 last:border-0">
                                                            <span className="text-slate-300">Romaneio <span className="font-bold text-slate-200">#{r.romaneio_id}</span></span>
                                                            <span className="font-mono font-medium text-emerald-400 bg-emerald-900/30 px-1.5 rounded">{r.quantidade} un</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-slate-600 flex justify-between font-bold text-white text-xs">
                                                    <span>Total Enviado:</span>
                                                    <span className={totalRomaneio >= parseFloat(item.quantidade) ? 'text-green-400' : 'text-amber-400'}>{totalRomaneio} / {parseFloat(item.quantidade)}</span>
                                                </div>
                                            </div>
                                            <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 mr-2 border-b border-r border-slate-700" />
                                        </div>
                                    </div>
                                )}
                                <span>{parseFloat(item.qtd_entreg || 0).toLocaleString('pt-BR')}</span>
                            </div>
                        </td>
                    );
                    case 'saldo_fat': {
                        // Na fração, o saldo exibido é a quantidade da própria fração
                        const saldo = parseFloat((isFraction ? item.visual_qtd : item.qtd_faturar) || 0);
                        return (
                            <td key={col.key} className={`px-4 py-2 text-right font-medium min-w-[80px] ${saldo <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`} title={isFraction ? `Saldo da fração (item: ${parseFloat(item.qtd_faturar || 0).toLocaleString('pt-BR')})` : undefined}>
                                {saldo.toLocaleString('pt-BR')}
                            </td>
                        );
                    }
                    case 'qtd': return (
                        <td key={col.key} className="px-4 py-2 text-right font-medium min-w-[80px]">
                            {parseFloat(item.quantidade).toLocaleString('pt-BR')} <span className="text-[10px] text-gray-400">{item.unidade}</span>
                        </td>
                    );
                    case 'lib_eng': return (
                        <td key={col.key} className="px-4 py-2 text-center min-w-[120px]">
                            <div className="flex flex-col gap-0.5">
                                <div className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.pcp_planned_eng_date ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-dashed border-gray-200'}`}>
                                    <Calendar className="h-2.5 w-2.5" />
                                    <span>Plan: {item.pcp_planned_eng_date ? new Date(item.pcp_planned_eng_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</span>
                                </div>
                                {item.designer_production_release_date && (
                                    <div className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                        <Calendar className="h-2.5 w-2.5" />
                                        <span>Real: {new Date(item.designer_production_release_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                    </div>
                                )}
                            </div>
                        </td>
                    );
                    case 'entrega': return (
                        <td key={col.key} className="px-4 py-2 text-center font-medium bg-blue-50 text-blue-800 rounded min-w-[100px]">
                            <div className="flex items-center justify-center gap-1">
                                <Calendar className="h-3 w-3 text-blue-400" />
                                {item.entrega ? item.entrega.replace(new RegExp("(\\d{4})(\\d{2})(\\d{2})"), '$3/$2/$1') : '-'}
                            </div>
                        </td>
                    );
                    case 'qtd_pcp': return (
                        <td key={col.key} className="px-3 py-2 text-center font-mono text-xs whitespace-nowrap min-w-[200px]">
                            {canEdit ? (
                                <div className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block" onClick={() => onSetPcpForecastTarget(item)} title="Clique para definir Qtd. PCP">
                                    <span className="group-hover/pcp:text-teal-900">{item.pcp_delivery_forecast_qtd ? parseFloat(item.pcp_delivery_forecast_qtd).toLocaleString('pt-BR') : 'Definir...'}</span>
                                </div>
                            ) : (
                                <div className="inline-block px-1 py-0.5">
                                    <span className="text-slate-700">{item.pcp_delivery_forecast_qtd ? parseFloat(item.pcp_delivery_forecast_qtd).toLocaleString('pt-BR') : '-'}</span>
                                </div>
                            )}
                        </td>
                    );
                    case 'data_pcp': return (
                        <td key={col.key} className="px-3 py-2 text-center whitespace-nowrap text-xs text-gray-700 min-w-[200px]">
                            {canEdit ? (
                                <div className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block" onClick={() => onSetPcpForecastTarget(item)} title="Clique para definir Data PCP">
                                    {item.pcp_delivery_forecast_date ? (
                                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold group-hover/pcp:border-teal-400">
                                            {formatProtheusDate(item.pcp_delivery_forecast_date)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 group-hover/pcp:text-teal-600">Definir...</span>
                                    )}
                                </div>
                            ) : (
                                <div className="inline-block px-1 py-0.5">
                                    {item.pcp_delivery_forecast_date ? (
                                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                                            {formatProtheusDate(item.pcp_delivery_forecast_date)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </div>
                            )}
                        </td>
                    );
                    case 'prev_fat': return (
                        <td key={col.key} className="px-4 py-2 text-center text-xs min-w-[110px]">
                            <BillingForecastInput item={item} user={user} onUpdateSuccess={onUpdateFaturamentoDate} canEdit={canEdit} />
                        </td>
                    );
                    case 'evolucao_op': return (
                        <td key={col.key} className="px-4 py-2 text-center text-xs min-w-[100px]">
                            {(() => {
                                const hasOP = !!item.op_num || !!item.op_protheus;
                                if (!hasOP) return <span className="text-gray-400">-</span>;
                                
                                const directPct = item.evolucao_pct !== undefined ? item.evolucao_pct : item.evolucao_op;
                                let pct = 0;
                                if (directPct !== undefined && directPct !== null) {
                                    pct = Math.min(100, Math.max(0, Number(directPct) || 0));
                                } else {
                                    const opQtd = parseFloat(item.op_qtd || 0);
                                    const saldoProd = parseFloat(item.saldo_produzido || 0);
                                    if (opQtd <= 0) return <span className="text-gray-500">0%</span>;
                                    pct = Math.min(100, Math.max(0, (saldoProd / opQtd) * 100));
                                }
                                
                                return (
                                    <div className="flex flex-col items-center justify-center gap-1 min-w-[60px]">
                                        <span className={`font-bold ${pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-blue-600' : 'text-gray-500'}`}>{pct.toFixed(0)}%</span>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                            <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </td>
                    );
                    default: return null;
                }
            })()))}
        </tr>
    );
};

// Custom comparison: only re-render when core data changes
const areEqual = (prev, next) => {
    return (
        prev.item.pedido === next.item.pedido &&
        prev.item.item === next.item.item &&
        prev.item.pcp_delivery_forecast_date === next.item.pcp_delivery_forecast_date &&
        prev.item.pcp_delivery_forecast_qtd === next.item.pcp_delivery_forecast_qtd &&
        prev.item.data_prevista_faturamento === next.item.data_prevista_faturamento &&
        prev.item.op_num === next.item.op_num &&
        prev.item.evolucao_pct === next.item.evolucao_pct &&
        prev.item.evolucao_op === next.item.evolucao_op &&
        prev.item.saldo_produzido === next.item.saldo_produzido &&
        prev.item.qtd_faturar === next.item.qtd_faturar &&
        prev.item.romaneios === next.item.romaneios &&
        prev.item.is_priority === next.item.is_priority &&
        prev.item.op_prioridade === next.item.op_prioridade &&
        prev.item.classificacao === next.item.classificacao &&
        prev.item.ppap_numero === next.item.ppap_numero &&
        prev.item.fraction_id === next.item.fraction_id &&
        prev.item.lpf_codigo === next.item.lpf_codigo &&
        prev.item.visual_qtd === next.item.visual_qtd &&
        prev.item.visual_op === next.item.visual_op &&
        prev.visibleColumns === next.visibleColumns &&
        prev.isSelected === next.isSelected &&
        prev.isActive === next.isActive &&
        prev.openActionMenu === next.openActionMenu &&
        prev.printingOrderId === next.printingOrderId
    );
};

export default React.memo(FlatItemRow, areEqual);
