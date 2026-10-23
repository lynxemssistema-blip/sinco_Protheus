import React, { forwardRef } from 'react';
import { getCompanyLegalName, getCompanyLogoBase64, getCompanyShortName } from '../services/companyBranding';

const ProductionPrint = forwardRef(({ ops, filters }, ref) => {

    const getStatusText = (op) => {
        const now = new Date();
        const start = op.data_planejada_inicio ? new Date(op.data_planejada_inicio) : null;
        const end = op.data_planejada_fim ? new Date(op.data_planejada_fim) : null;
        const done = Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op);
        const started = Number(op.qtd_produzida_real) > 0;

        if (done) return 'Concluído';
        if (end && now > end && !done) return 'Atraso Entrega';
        if (start && now > start && !started) return 'Atraso Início';
        if (start && end) return 'Planejado';
        return 'Aguardando';
    };

    const logo = getCompanyLogoBase64();
    const legalName = getCompanyLegalName();

    return (
        <div ref={ref} className="p-8 font-sans text-xs text-slate-900 bg-white print:p-0">
            {/* Header */}
            <div className="mb-6 border-b border-slate-300 pb-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {logo ? (
                            <img src={logo} alt="Logo" className="h-10 max-w-[120px] object-contain" />
                        ) : null}
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-800">Relatório de Controle de Produção</h1>
                            <p className="text-slate-500 mt-0.5 font-medium">{legalName}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold">{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR')}</p>
                        <p className="text-slate-500 mt-1">Total de OPs: {ops.length}</p>
                    </div>
                </div>

                {/* Filters Summary */}
                <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-600 grid grid-cols-4 gap-2">
                    {filters.op && <div><strong>OP:</strong> {filters.op}</div>}
                    {filters.produto && <div><strong>Produto:</strong> {filters.produto}</div>}
                    {filters.cliente && <div><strong>Cliente:</strong> {filters.cliente}</div>}
                    {filters.operacao && <div><strong>Operação:</strong> {filters.operacao}</div>}
                    {(filters.planned_date_start || filters.planned_date_end) && (
                        <div className="col-span-2"><strong>Período:</strong> {filters.planned_date_start} até {filters.planned_date_end}</div>
                    )}
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b-2 border-slate-800 text-[10px] uppercase tracking-wide">
                        <th className="py-2 w-24">OP / Item</th>
                        <th className="py-2">Cliente</th>
                        <th className="py-2">Produto</th>
                        <th className="py-2 w-32">Operação</th>
                        <th className="py-2 w-24 text-center">Início Plan.</th>
                        <th className="py-2 w-24 text-center">Fim Plan.</th>
                        <th className="py-2 w-24 text-center">Progresso</th>
                        <th className="py-2 w-24 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {ops.map((op, idx) => (
                        <tr key={idx} className="break-inside-avoid">
                            <td className="py-2 align-top font-bold">
                                {op.op}/{op.item_op}/{op.sequen}
                            </td>
                            <td className="py-2 align-top truncate max-w-[150px]">
                                {op.nome_cliente || 'Estoque/Interno'}
                            </td>
                            <td className="py-2 align-top">
                                <div className="font-bold text-[10px]">{op.cod_produto_op}</div>
                                <div className="text-[9px] text-slate-500 truncate max-w-[200px]">{op.desc_produto}</div>
                            </td>
                            <td className="py-2 align-top">
                                <div className="font-bold">{op.operacao}</div>
                                <div className="text-[9px] text-slate-500 truncate">{op.desc_operacao}</div>
                            </td>
                            <td className="py-2 align-top text-center text-[10px]">
                                {op.data_planejada_inicio ? new Date(op.data_planejada_inicio).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="py-2 align-top text-center text-[10px]">
                                {op.data_planejada_fim ? new Date(op.data_planejada_fim).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="py-2 align-top text-center font-mono">
                                {Number(op.qtd_produzida_real).toFixed(0)}/{Number(op.qtd_planejada_op).toFixed(0)}
                            </td>
                            <td className="py-2 align-top text-right font-bold">
                                {getStatusText(op)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {ops.length === 0 && (
                <div className="text-center py-8 text-slate-400 italic">Nenhum registro para exibir.</div>
            )}
        </div>
    );
});

export default ProductionPrint;
