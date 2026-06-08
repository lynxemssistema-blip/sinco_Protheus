import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Calendar, FileText, Settings, Layers, Package,
    StickyNote, MoreVertical, Loader2, Truck,
    Factory, ClipboardList, ImageIcon, FileSpreadsheet
} from 'lucide-react';
import ItemStatusBadge from './ItemStatusBadge';
import { getFileUrl } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { BillingForecastInput } from './BillingForecastInput';

/**
 * Memoized flat-view table row. Receives all data and callbacks as props.
 * Only re-renders when pedido, item, or PCP forecast fields change.
 */
const FlatItemRow = ({
    item,
    index,
    locationPathname,
    isSelected,
    printingOrderId,
    openActionMenu,
    menuPosition,
    // callbacks
    onSelectItem,
    onOpenDocs,
    onSetEngineeringTarget,
    onSetPcpForecastTarget,
    onSetNotesTarget,
    onSetInvoiceModal,
    onOpenActionMenu,
    formatProtheusDate,
    onPrintOPMirror,
    onPrintFichas,
    onPrintOPByOperation,
    onPrintOPByOperationWithDrawings,
    onPrintOPByResourceWithDrawings,
    onPrintOPWithOpsStampWithDrawings,
    onExportOPByOperationExcel,
    onSetMenuPosition,
    onUpdateFaturamentoDate,
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

    const menuKey = `flat-${item.pedido}-${item.item}`;
    const isMenuOpen = openActionMenu === menuKey;

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

    return (
        <tr
            className={`transition-colors border-b border-gray-50 last:border-0 ${
                parseFloat(item.qtd_faturar) <= 0
                    ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80'
                    : 'bg-white hover:bg-slate-50'
            } ${isSelected ? '!bg-blue-50' : ''}`}
        >
            {/* Checkbox */}
            <td className="px-2 py-2 text-center sticky left-0 z-10 bg-inherit min-w-[40px] max-w-[40px] w-[40px]" onClick={(e) => e.stopPropagation()}>
                <input
                    type="checkbox"
                    aria-label="Selecionar Item"
                    checked={isSelected}
                    onChange={() => onSelectItem(item)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
            </td>

            {/* Pedido */}
            <td className="px-3 py-2 whitespace-nowrap sticky left-[40px] z-10 bg-inherit min-w-[90px] max-w-[90px] w-[90px]">
                <span className="font-bold text-gray-900">{item.pedido}</span>
            </td>

            {/* Emissão */}
            <td className="px-3 py-2 text-center text-xs text-gray-600 whitespace-nowrap sticky left-[130px] z-10 bg-inherit min-w-[90px] max-w-[90px] w-[90px]">
                <div className="flex items-center justify-center gap-1">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    {formatProtheusDate(item.emissao)}
                </div>
            </td>

            {/* Ref. Cliente */}
            <td className="px-3 py-2 text-xs font-mono text-gray-600 sticky left-[220px] z-10 bg-inherit min-w-[100px] max-w-[100px] w-[100px] truncate">
                {item.ref_cliente || '-'}
            </td>

            {/* Cliente */}
            <td className="px-3 py-2 sticky left-[320px] z-10 bg-inherit min-w-[150px] max-w-[150px] w-[150px]">
                <div className="text-xs font-medium text-gray-700 truncate" title={item.nome_cliente}>
                    {item.nome_cliente}
                </div>
            </td>

            {/* PC (Ped. Cliente) */}
            <td className="px-3 py-2 text-xs text-gray-600 sticky left-[470px] z-10 bg-inherit min-w-[90px] max-w-[90px] w-[90px] truncate">
                {item.ped_cliente || '-'}
            </td>

            {/* Item */}
            <td className="px-2 py-2 text-center text-xs font-mono text-gray-500 sticky left-[560px] z-10 bg-inherit min-w-[40px] max-w-[40px] w-[40px]">
                {item.item}
            </td>

            {/* OP */}
            <td className="px-3 py-2 text-center sticky left-[600px] z-10 bg-inherit min-w-[80px] max-w-[80px] w-[80px]">
                <div className="flex items-center justify-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${item.op_tipo === 'F' ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200' : 'bg-blue-50 text-blue-700 font-medium'}`}>
                        {getDisplayOp(item.op_num, item.item) || '-'}
                    </span>
                    {hasOp && opTypeLabel}
                </div>
            </td>

            {/* Cód. Produto */}
            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap sticky left-[680px] z-10 bg-inherit min-w-[140px] max-w-[140px] w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate">
                <Link
                    to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                    state={{ from: locationPathname, pedido: item.pedido, item: item.item }}
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                    {item.codigo} <Layers className="h-3 w-3" />
                </Link>
            </td>

            {/* C6_XREVM */}
            <td className="px-4 py-2 text-center text-xs text-gray-500 font-mono">
                {item.rev_codigo || '-'}
            </td>

            {/* Rev. Cliente */}
            <td className="px-4 py-2 font-mono text-xs text-gray-500 text-center">
                {item.c6_rev_cliente || '-'}
            </td>

            {/* Ações */}
            <td className="px-4 py-2 text-center print:hidden">
                <div className="flex items-center justify-center gap-1">
                    {/* Docs */}
                    <button
                        onClick={() => {
                            if (item.has_drawing && item.drawing_url) {
                                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`), '_blank');
                            } else if (item.docs_count === 1 && item.first_doc) {
                                window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.first_doc)}`), '_blank');
                            } else {
                                onOpenDocs(item.codigo, item.descricao);
                            }
                        }}
                        className={`p-1.5 rounded-lg transition-all relative ${item.has_docs ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                        title={item.has_docs ? `${item.docs_count} Documento(s) - Clique para abrir` : 'Documentos'}
                    >
                        <FileText className="h-4 w-4" />
                        {item.has_docs && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                            </span>
                        )}
                    </button>

                    {/* Engenharia */}
                    <button
                        onClick={() => onSetEngineeringTarget({ orderId: item.pedido, item })}
                        className="p-1.5 text-gray-400 hover:text-blue-500 transition-all bg-gray-50/50 hover:bg-blue-50 rounded flex items-center justify-center"
                        title="Controle Engenharia / BOM"
                    >
                        <Settings className="h-4 w-4" />
                    </button>

                    {/* Dropdown: Impressão/Exportação */}
                    <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                            title="Mais ações"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isMenuOpen) {
                                    onOpenActionMenu(null);
                                } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const spaceAbove = rect.top;
                                    const menuHeight = 350;
                                    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                                        // Open upwards
                                        onSetMenuPosition({ top: undefined, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                                    } else {
                                        // Open downwards
                                        onSetMenuPosition({ top: rect.bottom + 4, bottom: undefined, right: window.innerWidth - rect.right });
                                    }
                                    onOpenActionMenu(menuKey);
                                }
                            }}
                            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
                        >
                            <MoreVertical className="h-4 w-4" />
                        </button>
                        {isMenuOpen && (
                            <div 
                                className="fixed z-[9999] bg-white rounded-lg border border-gray-200 shadow-xl py-1 min-w-[220px]"
                                style={{ 
                                    top: menuPosition?.top !== undefined ? `${menuPosition.top}px` : 'auto', 
                                    bottom: menuPosition?.bottom !== undefined ? `${menuPosition.bottom}px` : 'auto', 
                                    right: `${menuPosition?.right}px` 
                                }}
                            >
                                <button
                                    onClick={(e) => { onPrintOPMirror(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `op-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Factory className="h-4 w-4 flex-shrink-0 text-teal-500" />}
                                    <span>Espelho OP</span>
                                </button>
                                <button
                                    onClick={(e) => { onPrintFichas(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `ficha-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `ficha-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ClipboardList className="h-4 w-4 flex-shrink-0 text-amber-500" />}
                                    <span>Fichas de Operação</span>
                                </button>
                                <button
                                    onClick={(e) => { onPrintOPByOperation(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-oper-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `op-oper-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Layers className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                                    <span>Por Operações (PDF)</span>
                                </button>
                                <button
                                    onClick={(e) => { onPrintOPByOperationWithDrawings(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-drawings-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `op-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
                                    <span>OP + Desenhos (PDF)</span>
                                </button>
                                <button
                                    onClick={(e) => { onPrintOPByResourceWithDrawings(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-resource-drawings-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `op-resource-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-cyan-500" />}
                                    <span>OP + Desenhos (Por Recurso)</span>
                                </button>
                                <button
                                    onClick={(e) => { onPrintOPWithOpsStampWithDrawings(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-drawings-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-pink-50 hover:text-pink-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `op-stamp-drawings-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-pink-500" />}
                                    <span>OP + Desenhos (Roteiro no Carimbo)</span>
                                </button>
                                <button
                                    onClick={(e) => { onExportOPByOperationExcel(item.pedido, e, item.item); onOpenActionMenu(null); }}
                                    disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-excel-${item.pedido}-${item.item}`}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    {printingOrderId === `op-excel-${item.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
                                    <span>Por Operações (Excel)</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </td>

            {/* Tipo */}
            <td className="px-4 py-2 text-center">
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

            {/* Descrição */}
            <td className="px-4 py-2 text-xs text-gray-600 truncate max-w-[250px]" title={item.descricao}>
                {item.descricao}
            </td>

            {/* Status */}
            <td className="px-4 py-2 text-center">
                <ItemStatusBadge item={item} onNfClick={(nf) => handleNfClick(nf)} index={index} />
            </td>

            {/* Entregue */}
            <td className="px-4 py-2 text-right text-gray-600">
                <div className="flex items-center justify-end gap-1.5">
                    {romaneios.length > 0 && (
                        <div className="relative group/romaneio flex items-center">
                            <div className={`p-1 rounded cursor-help ${totalRomaneio >= parseFloat(item.quantidade) ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                <Truck className="h-4 w-4" />
                            </div>
                            <div className="absolute z-[60] bottom-full right-0 mb-2 hidden group-hover/romaneio:flex flex-col items-end">
                                <div className="bg-slate-800 text-slate-100 text-[11px] rounded p-2.5 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[200px]">
                                    <div className="font-bold text-white mb-2 border-b border-slate-600 pb-1 flex items-center gap-2">
                                        <Truck className="h-4 w-4 text-blue-400" />
                                        Expedição (Romaneios)
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
                                        <span className={totalRomaneio >= parseFloat(item.quantidade) ? 'text-green-400' : 'text-amber-400'}>
                                            {totalRomaneio} / {parseFloat(item.quantidade)}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 mr-2 border-b border-r border-slate-700" />
                            </div>
                        </div>
                    )}
                    <span>{parseFloat(item.qtd_entreg || 0).toLocaleString('pt-BR')}</span>
                </div>
            </td>

            {/* Saldo Fat. */}
            <td className={`px-4 py-2 text-right font-medium ${parseFloat(item.qtd_faturar) <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>
                {parseFloat(item.qtd_faturar || 0).toLocaleString('pt-BR')}
            </td>

            {/* Qtd. */}
            <td className="px-4 py-2 text-right font-medium">
                {parseFloat(item.quantidade).toLocaleString('pt-BR')}{' '}
                <span className="text-[10px] text-gray-400">{item.unidade}</span>
            </td>

            {/* Lib. Eng. */}
            <td className="px-4 py-2 text-center">
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

            {/* Entrega */}
            <td className="px-4 py-2 text-center flex items-center justify-center gap-1 font-medium bg-blue-50 text-blue-800 rounded">
                <Calendar className="h-3 w-3 text-blue-400" />
                {item.entrega ? item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}
            </td>

            {/* Qtd. PCP */}
            <td className="px-4 py-2 text-right text-xs font-medium text-teal-700">
                <div
                    className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                    onClick={() => onSetPcpForecastTarget(item)}
                    title="Clique para definir Qtd. PCP"
                >
                    <span className="group-hover/pcp:text-teal-900">
                        {item.pcp_delivery_forecast_qtd ? parseFloat(item.pcp_delivery_forecast_qtd).toLocaleString('pt-BR') : 'Definir...'}
                    </span>
                </div>
            </td>

            {/* Data PCP */}
            <td className="px-4 py-2 text-center text-xs">
                <div
                    className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                    onClick={() => onSetPcpForecastTarget(item)}
                    title="Clique para definir Data PCP"
                >
                    {item.pcp_delivery_forecast_date ? (
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold group-hover/pcp:border-teal-400">
                            {new Date(item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </span>
                    ) : (
                        <span className="text-gray-400 group-hover/pcp:text-teal-600">Definir...</span>
                    )}
                </div>
            </td>

            {/* Prev. Fat. */}
            <td className="px-4 py-2 text-center text-xs">
                <BillingForecastInput
                    item={item}
                    user={user}
                    onUpdateSuccess={onUpdateFaturamentoDate}
                />
            </td>
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
        prev.item.qtd_faturar === next.item.qtd_faturar &&
        prev.item.romaneios === next.item.romaneios &&
        prev.isSelected === next.isSelected &&
        prev.openActionMenu === next.openActionMenu &&
        prev.printingOrderId === next.printingOrderId
    );
};

export default React.memo(FlatItemRow, areEqual);
