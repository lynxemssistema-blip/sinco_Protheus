import React from 'react';
import { FileText } from 'lucide-react';

export const NfTooltip = ({ notas_fiscais, unidade, onNfClick }) => {
    if (!notas_fiscais || notas_fiscais.length === 0) return null;
    return (
        <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
            <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px]">
                <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Notas Fiscais:</div>
                {notas_fiscais.map((nf, idx) => (
                    <div
                        key={idx}
                        className="py-0.5 flex justify-between gap-3 hover:bg-slate-700/50 cursor-pointer rounded px-1 transition-colors group/nf"
                        onClick={(e) => { e.stopPropagation(); onNfClick && onNfClick(nf); }}
                    >
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
                ))}
            </div>
            <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700" />
        </div>
    );
};

/**
 * Renders ENTREGUE / PENDENTE / LIBERADO badge with NF tooltip on hover.
 * @param {object} item - order item object
 * @param {function} onNfClick - callback(nf) when a NF row is clicked
 */
const ItemStatusBadge = ({ item, onNfClick }) => {
    const qtdFaturar = parseFloat(item.qtd_faturar || 0);
    const hasNf = item.notas_fiscais && item.notas_fiscais.length > 0;

    if (qtdFaturar <= 0) {
        return (
            <div className="relative group inline-flex justify-center">
                <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded border border-green-200 cursor-help">
                    ENTREGUE
                </span>
                <NfTooltip notas_fiscais={item.notas_fiscais} unidade={item.unidade} onNfClick={onNfClick} />
            </div>
        );
    }

    if (!item.op_num || item.op_num === '-') {
        return (
            <div className="relative group inline-flex justify-center">
                <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded border border-red-200">
                    PENDENTE
                </span>
                <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
                    <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap">
                        Aguardando abertura de OP
                    </div>
                    <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700" />
                </div>
            </div>
        );
    }

    return (
        <div className="relative group inline-flex justify-center">
            <span className={`px-2 py-1 text-[10px] font-bold rounded border ${hasNf ? 'cursor-help' : ''} bg-orange-100 text-orange-700 border-orange-200`}>
                LIBERADO
            </span>
            {hasNf && (
                <NfTooltip notas_fiscais={item.notas_fiscais} unidade={item.unidade} onNfClick={onNfClick} />
            )}
        </div>
    );
};

export default React.memo(ItemStatusBadge);
