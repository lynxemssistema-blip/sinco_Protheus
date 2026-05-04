import React from 'react';
import metalfisaLogo from '../assets/metalfisa-logo.png';

const OrdemManutencaoPrint = React.forwardRef(({ ordem, materiais, historico, user }, ref) => {
    if (!ordem) return null;

    const dataAbertura = ordem.data_abertura ? new Date(ordem.data_abertura).toLocaleString('pt-BR') : '---';
    const dataInicio = ordem.data_inicio ? new Date(ordem.data_inicio).toLocaleString('pt-BR') : '---';
    const dataFim = ordem.data_fim ? new Date(ordem.data_fim).toLocaleString('pt-BR') : '---';

    const custoMateriais = Number(ordem.custo_materiais || 0);
    const custoServico = Number(ordem.custo_servico || 0);
    const custoTotal = custoMateriais + custoServico;

    // Helper para fotos da ordem (antes) e de execução (depois)
    const fotosProblema = typeof ordem.fotos === 'string' ? JSON.parse(ordem.fotos) : (ordem.fotos || []);
    const fotosExecucao = typeof ordem.fotos_execucao === 'string' ? JSON.parse(ordem.fotos_execucao) : (ordem.fotos_execucao || []);

    return (
        <div ref={ref} className="print-content text-sm bg-white p-8 w-full print:w-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Cabecalho */}
            <div className="border border-black mb-4">
                <div className="flex border-b border-black">
                    <div className="w-1/4 p-2 border-r border-black flex items-center justify-center">
                        <img src={metalfisaLogo} alt="MetalFisa" className="max-h-16" />
                    </div>
                    <div className="w-2/4 p-2 text-center uppercase font-bold flex flex-col items-center justify-center text-lg border-r border-black">
                        ORDEM DE MANUTENÇÃO (O.M.)
                        <span className="text-sm font-normal mt-1 text-slate-700">Relatório de Intervenção e Custos</span>
                    </div>
                    <div className="w-1/4 p-2 flex flex-col justify-center items-center">
                        <div className="font-bold text-lg">Nº {ordem.id.toString().padStart(4, '0')}</div>
                        <div className="text-xs mt-1">Impresso por: {user?.NomeCompleto || user?.nome || 'Sistema'}</div>
                        <div className="text-xs">{new Date().toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                {/* Dados da Maquina e Solicitante */}
                <div className="p-2 flex border-b border-black text-xs">
                    <div className="w-1/2 pr-2 border-r border-black">
                        <div className="font-bold text-xs mb-1 uppercase">DADOS DO ATIVO</div>
                        <div>Máquina/Equipamento: <span className="font-bold">{ordem.maquina_nome || 'N/A'}</span></div>
                        <div>Tipo de Manutenção: <span className="font-bold">{ordem.tipo_manutencao}</span></div>
                        <div>Prioridade: <span className="font-bold">{ordem.prioridade}</span></div>
                    </div>
                    <div className="w-1/2 pl-2">
                        <div className="font-bold text-xs mb-1 uppercase">RESPONSÁVEIS E PRAZOS</div>
                        <div>Solicitante: {ordem.solicitante_nome || '---'}</div>
                        <div>Técnico Responsável: {ordem.tecnico_nome || '---'}</div>
                        <div className="flex gap-4 mt-1">
                            <span>Abertura: {dataAbertura}</span>
                            <span>Fim: {dataFim}</span>
                        </div>
                    </div>
                </div>

                {/* Diagnostico e Execucao */}
                <div className="p-2 border-b border-black text-xs">
                    <div className="font-bold uppercase mb-1 text-red-700">SINTOMA / RELATO DO PROBLEMA:</div>
                    <div className="mb-2 whitespace-pre-wrap">{ordem.descricao_problema || 'Não informado.'}</div>
                    
                    <div className="font-bold uppercase mb-1 mt-2 text-blue-700">ATIVIDADES REALIZADAS:</div>
                    <div className="whitespace-pre-wrap">{ordem.atividades_realizadas || 'Nenhuma atividade registrada ainda.'}</div>
                    
                    {ordem.observacoes_tecnicas && (
                        <>
                            <div className="font-bold uppercase mb-1 mt-2">OBSERVAÇÕES TÉCNICAS:</div>
                            <div className="whitespace-pre-wrap">{ordem.observacoes_tecnicas}</div>
                        </>
                    )}
                </div>

                {/* Status e Custos Resumo */}
                <div className="p-2 flex text-xs bg-gray-50 items-center justify-between">
                    <div>
                        <span className="font-bold uppercase">STATUS ATUAL: </span>
                        <span className="bg-slate-200 px-2 py-0.5 border border-slate-300 font-bold">{ordem.status?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex gap-4 font-bold">
                        <div>Custos Materiais: R$ {custoMateriais.toFixed(2)}</div>
                        <div>Custo Serviço: R$ {custoServico.toFixed(2)}</div>
                        <div className="text-sm bg-yellow-200 px-2 border border-yellow-400">TOTAL O.M.: R$ {custoTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* Materiais Usados */}
            {materiais && materiais.length > 0 && (
                <>
                    <div className="font-bold uppercase text-xs mb-1 mt-4">MATERIAIS E PEÇAS APLICADOS</div>
                    <table className="w-full border-collapse border border-black mb-4 text-xs">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-1 text-center w-8">Item</th>
                                <th className="border border-black p-1 text-left w-24">Código</th>
                                <th className="border border-black p-1 text-left">Descrição</th>
                                <th className="border border-black p-1 text-center w-16">Unid.</th>
                                <th className="border border-black p-1 text-right w-16">Qtd.</th>
                                <th className="border border-black p-1 text-right w-20">Custo Un.</th>
                                <th className="border border-black p-1 text-right w-20">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materiais.map((m, index) => (
                                <tr key={index}>
                                    <td className="border border-black p-1 text-center">{index + 1}</td>
                                    <td className="border border-black p-1">{m.codigo || (m.is_novo ? 'NOVO' : '---')}</td>
                                    <td className="border border-black p-1">
                                        {m.descricao}
                                        {m.observacao && <div className="text-[9px] italic text-gray-500 mt-0.5">Obs: {m.observacao}</div>}
                                    </td>
                                    <td className="border border-black p-1 text-center">{m.unidade}</td>
                                    <td className="border border-black p-1 text-right">{m.quantidade}</td>
                                    <td className="border border-black p-1 text-right">{Number(m.custo_unitario || 0).toFixed(2)}</td>
                                    <td className="border border-black p-1 text-right font-bold">{Number(m.custo_total || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* Evidencias Visuais (Fotos) */}
            {(fotosProblema.length > 0 || fotosExecucao.length > 0) && (
                <div className="mt-4 page-break-inside-avoid">
                    <div className="font-bold uppercase text-xs mb-2">EVIDÊNCIAS VISUAIS (FOTOS)</div>
                    <div className="flex gap-4 flex-wrap">
                        {fotosProblema.map((f, i) => (
                            <div key={`prob-${i}`} className="border border-gray-400 p-1 bg-gray-50 text-center">
                                <img src={f.data || f} alt="Problema" className="w-40 h-40 object-cover" />
                                <div className="text-[9px] mt-1 font-bold text-red-600">ANTES (Problema)</div>
                            </div>
                        ))}
                        {fotosExecucao.map((f, i) => (
                            <div key={`exec-${i}`} className="border border-gray-400 p-1 bg-gray-50 text-center">
                                <img src={f.data || f} alt="Execucao" className="w-40 h-40 object-cover" />
                                <div className="text-[9px] mt-1 font-bold text-green-600">DEPOIS (Solução)</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Assinaturas */}
            <div className="flex gap-8 mt-16 text-xs page-break-inside-avoid">
                <div className="flex-1 text-center border-t border-black pt-2">
                    TÉCNICO RESPONSÁVEL
                </div>
                <div className="flex-1 text-center border-t border-black pt-2">
                    APROVAÇÃO DA QUALIDADE / PRODUÇÃO
                </div>
                <div className="flex-1 text-center border-t border-black pt-2">
                    GESTOR DE MANUTENÇÃO
                </div>
            </div>

            <style type="text/css" media="print">
                {`
                 @page { size: portrait; margin: 10mm; }
                 .print-content { display: block; width: 100%; }
                 .page-break-inside-avoid { page-break-inside: avoid; }
                `}
            </style>
        </div>
    );
});

export default OrdemManutencaoPrint;
