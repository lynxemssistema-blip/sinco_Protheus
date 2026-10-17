import React from 'react';
import { Printer, Package, Wrench, Layers, CheckCircle2, Clock, Calendar, AlertTriangle, GitFork, ShieldCheck } from 'lucide-react';
import { logoBase64 } from '../services/metalfisaLogoBase64';

const fmtDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw).replace(/-/g, '').trim();
    if (s.length === 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    return String(raw).substring(0, 10) || '—';
};

export default function BOMPrintLandscape({ data, opNum, itemPv, pedido, produto, activeRootKey, setActiveRootKey, livePendencias }) {
    const rootItens = React.useMemo(() => {
        if (!data?.pedidos) return [];
        return data.pedidos.flatMap(p => p.treeItens || []);
    }, [data]);

    // Encontra o item raiz especificamente selecionado
    const activeRootItem = React.useMemo(() => {
        if (!rootItens || rootItens.length === 0) return null;
        if (activeRootKey && activeRootKey !== 'all') {
            const found = rootItens.find(r => `${r.op}_${r.item_op}_${r.sequen}` === activeRootKey);
            if (found) return found;
        }
        return rootItens[0];
    }, [rootItens, activeRootKey]);

    const handlePrint = () => {
        const printContent = document.getElementById('bom-printable-area');
        if (!printContent) {
            window.print();
            return;
        }

        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const doc = printFrame.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatorio_Estrutura_OP_${activeRootItem ? `${activeRootItem.op}${activeRootItem.item_op}` : opNum}</title>
                <meta charset="utf-8" />
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @page { size: A4 landscape; margin: 8mm; }
                    body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, sans-serif; }
                    * { box-sizing: border-box; }
                    .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                    .print-hidden, .print\\:hidden { display: none !important; }
                </style>
            </head>
            <body class="p-2">
                ${printContent.outerHTML}
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            setTimeout(() => {
                if (document.body.contains(printFrame)) {
                    document.body.removeChild(printFrame);
                }
            }, 2000);
        }, 300);
    };

    // Flatten a hierarquia da OP raiz selecionada (PA + seus PIs/filhos) sem duplicidades
    const collectHierarchy = (item, level = 0, parentOp = '', visitedNodes = new Set()) => {
        if (!item) return [];
        const nodeKey = `${item.op}_${item.item_op}_${item.sequen}`;
        if (visitedNodes.has(nodeKey)) return [];
        visitedNodes.add(nodeKey);

        let list = [{ ...item, level, parentOp }];
        const children = item.subItens || item.filhos || [];
        if (children && children.length > 0) {
            children.forEach(child => {
                list = list.concat(collectHierarchy(child, level + 1, `${item.op}${item.item_op}`, visitedNodes));
            });
        }
        return list;
    };

    const selectedOps = React.useMemo(() => {
        if (!activeRootItem) return [];
        return collectHierarchy(activeRootItem, 0, '', new Set());
    }, [activeRootItem]);

    // Extrai todas as pendências operacionais (operações com status != 'done') da árvore da OP selecionada sem repetições
    const pendenciasDestaOp = React.useMemo(() => {
        if (!selectedOps || selectedOps.length === 0) return [];
        const pends = [];
        const seenOpKeys = new Set();
        selectedOps.forEach(item => {
            (item?.recursos || []).forEach(r => {
                if (r.status !== 'done') {
                    const opKey = `${item.op}_${item.item_op}_${item.sequen}_${r.operac}_${r.recurso}`;
                    if (!seenOpKeys.has(opKey)) {
                        seenOpKeys.add(opKey);
                        const plan = Number(r.qtde_planejada || item.qtde || 0);
                        const feita = Number(r.qtde_produzida || 0);
                        const saldo = Math.max(0, plan - feita);
                        pends.push({
                            op: item.op,
                            item_op: item.item_op,
                            sequen: item.sequen,
                            op_completa: `${item.op}${item.item_op}${item.sequen ? `.${item.sequen}` : ''}`,
                            produto: item.produto,
                            desc_produto: item.desc_produto,
                            operac: r.operac,
                            recurso: r.recurso,
                            desc_recurso: r.desc_recurso || r.recurso,
                            data_planejada_inicio: r.data_planejada_inicio,
                            qtde_planejada: plan,
                            qtde_produzida: feita,
                            saldo: saldo,
                            status: r.status,
                            pct: r.pct || (plan > 0 ? Math.round((feita / plan) * 100) : 0)
                        });
                    }
                }
            });
        });
        return pends;
    }, [selectedOps]);

    const clienteNome = data?.pedidos?.[0]?.cliente || data?.pedidos?.[0]?.nome_cliente || '—';

    return (
        <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto">
            {/* Action Bar (Oculta na impressão) */}
            <div className="bg-slate-200 border-b border-slate-300 px-6 py-3 flex items-center justify-between print:hidden sticky top-0 z-10 shadow-xs">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-blue-700" />
                        Relatório Oficial Lynx — Formato A4 Deitado (Paisagem)
                    </span>
                    {rootItens.length > 1 && (
                        <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-300">
                            <span className="text-xs text-slate-600 font-medium">OP Selecionada:</span>
                            <select
                                value={activeRootKey || ''}
                                onChange={(e) => setActiveRootKey && setActiveRootKey(e.target.value)}
                                className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:ring-1 focus:ring-blue-500 shadow-xs"
                            >
                                {rootItens.map((r) => {
                                    const key = `${r.op}_${r.item_op}_${r.sequen}`;
                                    const displayItem = r.item_pv || r.item_op || '';
                                    return (
                                        <option key={key} value={key}>
                                            OP {r.op} (Item {displayItem}) — {r.produto} ({r.desc_produto?.substring(0, 25)}...)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handlePrint}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
                >
                    <Printer className="w-4 h-4" />
                    Imprimir Relatório (Ctrl + P)
                </button>
            </div>

            {/* Página A4 Deitado / Paisagem */}
            <div className="p-4 sm:p-8 flex justify-center">
                <div id="bom-printable-area" className="bg-white w-full max-w-[1140px] p-6 sm:p-8 rounded-xl shadow-lg border border-slate-300 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none text-slate-900 text-xs">
                    
                    {/* ═══ CABEÇALHO PADRÃO OFICIAL LYNX ═══ */}
                    <div className="border-2 border-slate-800 rounded-t-lg overflow-hidden mb-3">
                        <div className="grid grid-cols-12 divide-x-2 divide-slate-800 bg-slate-50">
                            {/* Logo */}
                            <div className="col-span-3 p-2.5 flex flex-col items-center justify-center bg-white">
                                {logoBase64 ? (
                                    <img 
                                        src={logoBase64} 
                                        alt="Logo Lynx" 
                                        className="h-11 object-contain max-w-full"
                                    />
                                ) : (
                                    <div className="font-extrabold text-lg text-slate-900 tracking-tight">LYNX</div>
                                )}
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">
                                    Estruturas Metálicas
                                </span>
                            </div>

                            {/* Título Central */}
                            <div className="col-span-6 p-2.5 flex flex-col items-center justify-center text-center bg-white">
                                <h1 className="text-sm font-extrabold text-slate-950 uppercase tracking-tight">
                                    Relatório de Estrutura e Roteiro de Produção
                                </h1>
                                <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                    Engenharia de Processos & Planejamento e Controle da Produção (PCP)
                                </p>
                            </div>

                            {/* Metadados da Ordem */}
                            <div className="col-span-3 p-2 text-[10px] flex flex-col justify-center space-y-1 bg-slate-50">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Ordem Produção (OP):</span>
                                    <span className="font-mono font-bold text-blue-900 text-xs">
                                        {activeRootItem?.op || opNum}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Item OP / PV:</span>
                                    <span className="font-mono font-bold text-slate-900">
                                        Item {activeRootItem?.item_pv || activeRootItem?.item_op || itemPv || '01'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Pedido Venda:</span>
                                    <span className="font-bold text-slate-800">{activeRootItem?.pedido || pedido || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-semibold">Emissão:</span>
                                    <span className="font-semibold text-slate-700">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Linha Informativa do Produto Principal */}
                        <div className="border-t-2 border-slate-800 bg-slate-100/90 p-2.5 grid grid-cols-12 gap-2 text-xs">
                            <div className="col-span-6 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Produto Principal:</span>
                                <span className="font-mono font-bold text-slate-950">{activeRootItem?.produto || produto}</span>
                                <span className="text-slate-700 font-medium truncate">— {activeRootItem?.desc_produto}</span>
                            </div>
                            <div className="col-span-6 flex items-center justify-end gap-5 text-xs font-semibold">
                                <span>Qtd Ordem: <strong className="text-slate-950 font-bold">{activeRootItem?.qtde || 0}</strong></span>
                                <span>Concluído: <strong className="text-emerald-700 font-bold">{activeRootItem?.qtde_feita || 0}</strong></span>
                                <span>Saldo: <strong className="text-blue-700 font-bold">{activeRootItem?.qtde_pendente || 0}</strong></span>
                                <span className="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                                    {activeRootItem?.qtde > 0 ? Math.round((activeRootItem.qtde_feita / activeRootItem.qtde) * 100) : 0}% Feito
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ═══ ESTRUTURA HIERÁRQUICA E ROTEIRO DA OP SELECIONADA ═══ */}
                    <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-300 text-slate-800">
                            <GitFork className="w-3.5 h-3.5 text-blue-700" />
                            <h2 className="text-xs font-bold uppercase tracking-wider">
                                Estrutura de Fabricação da OP ({selectedOps.length} Componente{selectedOps.length > 1 ? 's' : ''})
                            </h2>
                        </div>

                        {selectedOps.map((opItem, idx) => {
                            const isPA = opItem.level === 0;
                            const pctFeito = opItem.qtde > 0 ? Math.round((opItem.qtde_feita / opItem.qtde) * 100) : 0;
                            
                            return (
                                <div 
                                    key={`${opItem.op}_${opItem.item_op}_${opItem.sequen}_${idx}`}
                                    className={`rounded-lg border p-3 break-inside-avoid ${
                                        isPA 
                                            ? 'bg-emerald-50/30 border-emerald-400 ring-1 ring-emerald-300/50' 
                                            : 'bg-slate-50/50 border-slate-300 ml-4'
                                    }`}
                                >
                                    {/* Header do Componente */}
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                isPA ? 'bg-emerald-700 text-white' : 'bg-blue-700 text-white'
                                            }`}>
                                                {isPA ? 'PA (Principal)' : `PI (Sub-OP Nível ${opItem.level})`}
                                            </span>
                                            <span className="font-mono font-bold text-xs text-slate-900">
                                                OP {opItem.op} (Item {opItem.item_pv || opItem.item_op || '01'})
                                            </span>
                                            <span className="font-bold text-xs text-slate-950">
                                                {opItem.produto} — {opItem.desc_produto}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-semibold">
                                            <span>Qtd: <strong>{opItem.qtde}</strong></span>
                                            <span>Feito: <strong className="text-emerald-700">{opItem.qtde_feita}</strong></span>
                                            <span>Saldo: <strong className="text-blue-700">{opItem.qtde_pendente}</strong></span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                pctFeito === 100 ? 'bg-emerald-100 text-emerald-800' : pctFeito > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {pctFeito}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Grid de Roteiro de Operações e Matérias-Primas Lado a Lado */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
                                        
                                        {/* Roteiro de Operações */}
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1">
                                                <Wrench className="w-3 h-3 text-blue-600" />
                                                Roteiro de Operações ({opItem?.recursos?.length || 0})
                                            </p>
                                            {opItem?.recursos && opItem.recursos.length > 0 ? (
                                                <div className="space-y-1">
                                                    {opItem.recursos.map((rec, rIdx) => (
                                                        <div key={rIdx} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-50 border border-slate-200">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono font-bold text-slate-700 bg-slate-200 px-1 py-0.5 rounded text-[10px]">
                                                                    Op {rec.operac}
                                                                </span>
                                                                <span className="font-semibold text-slate-800">{rec.desc_recurso || rec.recurso}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {rec.data_planejada_inicio && (
                                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                                        Plan: {fmtDate(rec.data_planejada_inicio)}
                                                                    </span>
                                                                )}
                                                                <span className={`w-2.5 h-2.5 rounded-full ${
                                                                    rec.status === 'done' ? 'bg-emerald-500' : rec.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                                                                }`} title={rec.status === 'done' ? 'Concluído' : rec.status === 'in_progress' ? 'Em Andamento' : 'Aguardando'} />
                                                                <span className="font-bold text-[10px] text-slate-700">
                                                                    {rec.qtde_produzida || 0}/{rec.qtde_planejada || opItem.qtde}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 italic p-1">Nenhuma operação cadastrada no roteiro.</p>
                                            )}
                                        </div>

                                        {/* Matérias-Primas e Insumos (BOM) */}
                                        <div className="bg-white p-2 rounded border border-slate-200">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1">
                                                <Layers className="w-3 h-3 text-amber-600" />
                                                Matérias-Primas / Insumos BOM ({opItem.materiais?.length || 0})
                                            </p>
                                            {opItem.materiais && opItem.materiais.length > 0 ? (
                                                <div className="space-y-1">
                                                    {opItem.materiais.map((mat, mIdx) => (
                                                        <div key={mIdx} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-amber-50/40 border border-amber-200">
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="font-mono font-bold text-slate-800 text-[10px]">
                                                                    {mat.codigo || mat.produto}
                                                                </span>
                                                                <span className="text-[10px] text-slate-600 truncate">
                                                                    {mat.descricao || mat.desc_produto}
                                                                </span>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <span className="font-bold text-slate-900 text-xs">
                                                                    {mat.qtde_total || mat.quantidade || mat.qtde} {mat.um || 'UN'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 italic p-1">Nenhuma matéria-prima direta cadastrada.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ═══ QUADRO DE PENDÊNCIAS OPERACIONAIS INTEGRADO ═══ */}
                    <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 break-inside-avoid">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                {pendenciasDestaOp.length > 0 ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                ) : (
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                )}
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                    Lista de Pendências de Apontamento da OP
                                </h3>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                pendenciasDestaOp.length > 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                                {pendenciasDestaOp.length > 0 ? `${pendenciasDestaOp.length} Operação(ões) Pendente(s)` : 'Nenhuma Pendência — Ordem 100% Apontada'}
                            </span>
                        </div>

                        {pendenciasDestaOp.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[11px] text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-200 text-slate-700 uppercase text-[9px] font-bold">
                                            <th className="p-1.5 border border-slate-300">OP</th>
                                            <th className="p-1.5 border border-slate-300">Produto</th>
                                            <th className="p-1.5 border border-slate-300">Descrição</th>
                                            <th className="p-1.5 border border-slate-300 text-center">Operação</th>
                                            <th className="p-1.5 border border-slate-300">Recurso / Posto</th>
                                            <th className="p-1.5 border border-slate-300 text-center">Data Plan.</th>
                                            <th className="p-1.5 border border-slate-300 text-center">Qtd Plan.</th>
                                            <th className="p-1.5 border border-slate-300 text-center">Apontado</th>
                                            <th className="p-1.5 border border-slate-300 text-center">Saldo</th>
                                            <th className="p-1.5 border border-slate-300 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {pendenciasDestaOp.map((pend, pIdx) => (
                                            <tr key={pIdx} className="hover:bg-slate-50">
                                                <td className="p-1.5 font-mono font-bold text-slate-900 border border-slate-200">
                                                    {pend.op_completa}
                                                </td>
                                                <td className="p-1.5 font-mono font-bold text-slate-800 border border-slate-200">
                                                    {pend.produto}
                                                </td>
                                                <td className="p-1.5 text-slate-700 border border-slate-200 max-w-[200px] truncate">
                                                    {pend.desc_produto}
                                                </td>
                                                <td className="p-1.5 text-center font-mono font-bold text-slate-800 border border-slate-200 bg-slate-50">
                                                    Op {pend.operac}
                                                </td>
                                                <td className="p-1.5 font-semibold text-slate-800 border border-slate-200">
                                                    {pend.desc_recurso} ({pend.recurso})
                                                </td>
                                                <td className="p-1.5 text-center text-slate-600 border border-slate-200">
                                                    {fmtDate(pend.data_planejada_inicio)}
                                                </td>
                                                <td className="p-1.5 text-center font-semibold border border-slate-200">{pend.qtde_planejada}</td>
                                                <td className="p-1.5 text-center text-emerald-700 font-bold border border-slate-200">{pend.qtde_produzida}</td>
                                                <td className="p-1.5 text-center text-red-600 font-extrabold border border-slate-200 bg-red-50/40">{pend.saldo}</td>
                                                <td className="p-1.5 text-center border border-slate-200">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                        pend.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                                                    }`}>
                                                        {pend.status === 'in_progress' ? 'Em Andamento' : 'Aguardando'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-3 text-center text-emerald-800 font-medium text-xs flex items-center justify-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                Todas as operações de fabricação desta OP foram apontadas e concluídas.
                            </div>
                        )}
                    </div>

                    {/* ═══ RODAPÉ OFICIAL LYNX ═══ */}
                    <div className="mt-4 pt-2 border-t-2 border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span>Lynx ERP • Sistema de Gestão Industrial Integrada</span>
                        <span>Documento emitido eletronicamente • Formato A4 Paisagem (Landscape)</span>
                    </div>
                </div>
            </div>

            {/* CSS de Impressão Específico para A4 Landscape */}
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 8mm;
                    }
                    html, body {
                        height: 100% !important;
                        overflow: hidden !important;
                        background: #ffffff !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #bom-printable-area, #bom-printable-area * {
                        visibility: visible !important;
                    }
                    #bom-printable-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
