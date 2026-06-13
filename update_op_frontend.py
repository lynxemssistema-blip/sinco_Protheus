import sys

path = r'c:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\vmi\DemandaVMIPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

op_tooltip = """
const OpTooltip = ({ ops, index }) => {
    if (!ops || ops.length === 0) return null;
    const isTopRow = typeof index === 'number' && index < 3;
    return (
        <div className={`absolute z-50 ${isTopRow ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} left-1/2 -translate-x-1/2 hidden group-hover/op:flex flex-col items-center animate-fade-in`}>
            {isTopRow && (
                <div className="w-2.5 h-2.5 bg-slate-900 border-t border-l border-slate-800 rotate-45 -mb-1.5 z-10" />
            )}
            <div className="bg-slate-900/95 backdrop-blur-md text-slate-100 text-[10px] rounded-lg p-2.5 shadow-2xl border border-slate-800 whitespace-nowrap text-left min-w-[220px]">
                <div className="font-bold text-blue-400 mb-1.5 border-b border-slate-800 pb-1 flex items-center justify-between">
                    <span>Ordens de Produção (OPs)</span>
                    <span className="text-[9px] text-slate-500 font-normal">{ops.length} {ops.length === 1 ? 'OP' : 'OPs'}</span>
                </div>
                <div className="max-h-[160px] overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
                    {ops.map((op, idx) => (
                        <div key={idx} className="py-1 flex justify-between gap-4 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/50 rounded px-1.5 transition-all">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-200">OP {op.op}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`font-mono font-bold ${op.progresso === 100 ? 'text-emerald-400' : 'text-blue-400'}`}>{op.progresso}%</span>
                                <div className="w-12 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${op.progresso}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {!isTopRow && (
                <div className="w-2.5 h-2.5 bg-slate-900 border-b border-r border-slate-800 rotate-45 -mt-1.5 z-10" />
            )}
        </div>
    );
};
"""

c = c.replace('const NfTooltip = ({ notasFiscais, index }) => {', op_tooltip + '\nconst NfTooltip = ({ notasFiscais, index }) => {')

c = c.replace(
    '<td className="px-4 py-2 font-mono text-xs text-center text-slate-600">{r.pedido_metalfisa || \'-\'}</td>',
    """                <td className="px-4 py-2 font-mono text-xs text-center text-slate-600">
                    <div className="relative group/op inline-flex justify-center items-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${r.ops_relacionadas && r.ops_relacionadas.length > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100 cursor-help' : ''}`}>
                            {r.pedido_metalfisa || '-'}
                        </span>
                        {r.ops_relacionadas && r.ops_relacionadas.length > 0 && (
                            <OpTooltip ops={r.ops_relacionadas} index={i} />
                        )}
                    </div>
                </td>"""
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated frontend for OPs")
