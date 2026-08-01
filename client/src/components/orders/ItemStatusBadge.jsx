import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';

export const NfTooltipPortal = ({ targetRef, notas_fiscais, unidade, onNfClick }) => {
    if (!notas_fiscais || notas_fiscais.length === 0 || !targetRef.current) return null;

    const rect = targetRef.current.getBoundingClientRect();
    
    // Position below the element if there is space, otherwise above.
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferBelow = spaceBelow > 200; // if we have 200px below
    
    const top = preferBelow 
        ? rect.bottom + window.scrollY + 8 
        : rect.top + window.scrollY - 8;
        
    const left = rect.left + rect.width / 2 + window.scrollX;

    const style = {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        transform: preferBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        zIndex: 9999,
    };

    return createPortal(
        <div 
            style={style}
            className="flex flex-col items-center pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
        >
            {!preferBelow && (
                <div className="w-2 h-2 bg-slate-800 rotate-45 -mb-1 border-t border-l border-slate-700 z-10" />
            )}
            <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px]">
                <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Notas Fiscais:</div>
                {notas_fiscais.map((nf, idx) => (
                    <div
                        key={idx}
                        className="py-1 flex flex-col hover:bg-slate-700/50 cursor-pointer rounded px-1 transition-colors group/nf"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            onNfClick && onNfClick(nf); 
                        }}
                    >
                        <div className="flex justify-between gap-3">
                            <span>
                                <span className="text-slate-400">NF:</span> {nf.nota}{' '}
                                <span className="text-slate-500">({nf.serie})</span>{' '}
                                <span className="text-blue-300 ml-1">[{nf.natureza || '-'}]</span>
                            </span>
                            <span>
                                <span className="text-slate-400">Emissão:</span> {nf.emissao}{' '}
                                <span className="text-slate-500 ml-2">CFOP: {nf.cfop || '-'}</span>
                            </span>
                            <span className="font-semibold text-blue-300 ml-2 flex items-center gap-1">
                                {nf.qtd} {unidade}
                                <FileText className="h-3 w-3 opacity-0 group-hover/nf:opacity-100 transition-opacity" />
                            </span>
                        </div>
                        {nf.nome_cliente && (
                            <div className="text-[9px] text-slate-300 mt-0.5 truncate max-w-[300px]">
                                <span className="text-slate-400">Para:</span> {nf.nome_cliente}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {preferBelow && (
                <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700" />
            )}
        </div>,
        document.body
    );
};

/**
 * Renders ENTREGUE / PENDENTE / LIBERADO badge with NF tooltip on hover via React Portal.
 * @param {object} item - order item object
 * @param {function} onNfClick - callback(nf) when a NF row is clicked
 */
const ItemStatusBadge = ({ item, onNfClick }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const badgeRef = useRef(null);

    const qtdFaturar = parseFloat(item.qtd_faturar || 0);
    const hasNf = item.notas_fiscais && item.notas_fiscais.length > 0;

    if (qtdFaturar <= 0) {
        return (
            <div 
                ref={badgeRef}
                className="relative inline-flex justify-center"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded border border-green-200 cursor-help">
                    ENTREGUE
                </span>
                {showTooltip && (
                    <NfTooltipPortal 
                        targetRef={badgeRef} 
                        notas_fiscais={item.notas_fiscais} 
                        unidade={item.unidade} 
                        onNfClick={onNfClick} 
                    />
                )}
            </div>
        );
    }

    if (!item.op_num || item.op_num === '-') {
        return (
            <div 
                ref={badgeRef}
                className="relative inline-flex justify-center"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded border border-red-200">
                    PENDENTE
                </span>
                {showTooltip && createPortal(
                    (() => {
                        if (!badgeRef.current) return null;
                        const rect = badgeRef.current.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        const preferBelow = spaceBelow > 100;
                        const top = preferBelow 
                            ? rect.bottom + window.scrollY + 8 
                            : rect.top + window.scrollY - 8;
                        const left = rect.left + rect.width / 2 + window.scrollX;
                        const style = {
                            position: 'absolute',
                            top: `${top}px`,
                            left: `${left}px`,
                            transform: preferBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                            zIndex: 9999,
                        };
                        return (
                            <div style={style} className="flex flex-col items-center pointer-events-none">
                                {!preferBelow && (
                                    <div className="w-2 h-2 bg-slate-800 rotate-45 -mb-1 border-t border-l border-slate-700 z-10" />
                                )}
                                <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap">
                                    Aguardando abertura de OP
                                </div>
                                {preferBelow && (
                                    <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700" />
                                )}
                            </div>
                        );
                    })(),
                    document.body
                )}
            </div>
        );
    }

    return (
        <div 
            ref={badgeRef}
            className="relative inline-flex justify-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className={`px-2 py-1 text-[10px] font-bold rounded border ${hasNf ? 'cursor-help' : ''} bg-orange-100 text-orange-700 border-orange-200`}>
                LIBERADO
            </span>
            {showTooltip && hasNf && (
                <NfTooltipPortal 
                    targetRef={badgeRef} 
                    notas_fiscais={item.notas_fiscais} 
                    unidade={item.unidade} 
                    onNfClick={onNfClick} 
                />
            )}
        </div>
    );
};

export default React.memo(ItemStatusBadge);
