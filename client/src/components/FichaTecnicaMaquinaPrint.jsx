import React, { forwardRef } from 'react';
import { getCompanyLogoBase64, getCompanyShortName, getCompanyLegalName } from '../services/companyBranding';

const FichaTecnicaMaquinaPrint = forwardRef(({ maquina, checklistsModelos, categorias, setores }, ref) => {
    if (!maquina) return null;

    const logo = getCompanyLogoBase64();
    const shortName = getCompanyShortName();

    const catName = categorias?.find(c => c.id === maquina.id_categoria)?.nome || 'Não definida';
    const setorName = setores?.find(s => s.id === maquina.id_setor)?.nome || 'Não definido';
    
    // Parse the lists
    let vinculadosIds = [];
    if (typeof maquina.checklists_vinculados === 'string') {
        try { vinculadosIds = JSON.parse(maquina.checklists_vinculados); } catch(e) {}
    } else if (Array.isArray(maquina.checklists_vinculados)) {
        vinculadosIds = maquina.checklists_vinculados;
    }

    const checklistsAssociados = (checklistsModelos || []).filter(c => vinculadosIds.some(v => parseInt(v) === parseInt(c.id)));

    // Parse fotos if needed for header, we'll just show the first photo if it exists
    let fotos = [];
    if (typeof maquina.fotos === 'string') {
        try { fotos = JSON.parse(maquina.fotos); } catch(e) {}
    } else if (Array.isArray(maquina.fotos)) {
        fotos = maquina.fotos;
    }

    // Rental data if rented
    let dadosAluguel = {};
    if (typeof maquina.dados_aluguel === 'string') {
        try { dadosAluguel = JSON.parse(maquina.dados_aluguel); } catch(e) {}
    } else if (maquina.dados_aluguel) {
        dadosAluguel = maquina.dados_aluguel;
    }

    const today = new Date().toLocaleDateString('pt-BR');

    return (
        <div ref={ref} className="bg-white p-8 print-container max-w-[210mm] mx-auto text-slate-800" style={{ fontFamily: 'Arial, sans-serif' }}>
            <style>
                {`
                @media print {
                    @page { size: A4; margin: 15mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
                    .print-page-break { page-break-before: always; }
                }
                `}
            </style>

            {/* HEADER ISO */}
            <div className="flex border-2 border-slate-800 mb-6 rounded-sm">
                <div className="w-1/4 border-r-2 border-slate-800 flex items-center justify-center p-3 text-center">
                    {logo ? (
                        <img src={logo} alt={shortName} className="max-h-12 max-w-full object-contain" />
                    ) : (
                        <h1 className="text-xl font-black tracking-tighter text-slate-900">{shortName}</h1>
                    )}
                </div>
                <div className="w-2/4 flex flex-col items-center justify-center p-2 border-r-2 border-slate-800 text-center">
                    <h2 className="text-lg font-bold uppercase tracking-wide">Ficha Técnica de Equipamento</h2>
                    <h3 className="text-sm font-semibold text-slate-600 uppercase">Manutenção & Inspeção</h3>
                </div>
                <div className="w-1/4 flex flex-col justify-center text-[10px] font-bold p-2">
                    <div className="border-b border-slate-400 pb-1 mb-1">CÓD: FTM-{maquina.id?.toString().padStart(4, '0')}</div>
                    <div className="border-b border-slate-400 pb-1 mb-1">REV: 01</div>
                    <div>DATA: {today}</div>
                </div>
            </div>

            {/* DADOS DO EQUIPAMENTO */}
            <div className="mb-6 border-2 border-slate-800 rounded-sm print-break-inside-avoid">
                <div className="bg-slate-800 text-white font-bold px-3 py-1 text-sm uppercase">1. Identificação do Equipamento</div>
                <div className="p-3 grid grid-cols-4 gap-y-3 gap-x-4 text-xs">
                    <div className="col-span-2">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Nome/Modelo</div>
                        <div className="font-bold text-base border-b border-slate-300 pb-1">{maquina.nome}</div>
                    </div>
                    <div className="col-span-1">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Tag de Identificação</div>
                        <div className="font-bold text-sm border-b border-slate-300 pb-1">{maquina.tag_identificacao || 'N/A'}</div>
                    </div>
                    <div className="col-span-1">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Número de Série</div>
                        <div className="font-bold text-sm border-b border-slate-300 pb-1">{maquina.numero_serie || 'N/A'}</div>
                    </div>

                    <div className="col-span-1">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Tipo</div>
                        <div className="font-bold text-sm border-b border-slate-300 pb-1">{maquina.tipo}</div>
                    </div>
                    <div className="col-span-1">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Categoria</div>
                        <div className="font-bold text-sm border-b border-slate-300 pb-1">{catName}</div>
                    </div>
                    <div className="col-span-2">
                        <div className="font-bold text-slate-500 uppercase text-[10px]">Setor Responsável</div>
                        <div className="font-bold text-sm border-b border-slate-300 pb-1">{setorName}</div>
                    </div>
                    
                    {maquina.tipo === 'ALUGADO' && (
                        <div className="col-span-4 grid grid-cols-4 gap-4 mt-2 bg-slate-100 p-2 rounded border border-slate-300">
                            <div className="col-span-4 font-bold text-slate-600 text-[10px] uppercase border-b border-slate-300 pb-1 mb-1">Dados de Locação</div>
                            <div>
                                <div className="font-bold text-slate-500 uppercase text-[9px]">Série do Locador</div>
                                <div className="font-semibold text-xs">{dadosAluguel?.numero_serie_locador || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="font-bold text-slate-500 uppercase text-[9px]">Início Contrato</div>
                                <div className="font-semibold text-xs">{dadosAluguel?.data_inicio ? new Date(dadosAluguel.data_inicio).toLocaleDateString('pt-BR') : 'N/A'}</div>
                            </div>
                            <div>
                                <div className="font-bold text-slate-500 uppercase text-[9px]">Validade Contrato</div>
                                <div className="font-semibold text-xs">{dadosAluguel?.data_validade ? new Date(dadosAluguel.data_validade).toLocaleDateString('pt-BR') : 'N/A'}</div>
                            </div>
                            <div>
                                <div className="font-bold text-slate-500 uppercase text-[9px]">Certificação Inclusa</div>
                                <div className="font-semibold text-xs">{dadosAluguel?.certificacao_inclusa ? 'SIM' : 'NÃO'}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CHECKLISTS (MANUAL FILLING) */}
            {checklistsAssociados.length > 0 ? (
                checklistsAssociados.map((chk, idx) => {
                    let items = [];
                    if (typeof chk.itens === 'string') {
                        try { items = JSON.parse(chk.itens); } catch(e) {}
                    } else if (Array.isArray(chk.itens)) {
                        items = chk.itens;
                    }

                    return (
                        <div key={chk.id} className="mb-6 print-page-break">
                            {/* HEADER DO CHECKLIST ISO */}
                            <div className="flex border-2 border-slate-800 mb-2 rounded-sm bg-slate-100">
                                <div className="w-3/4 flex flex-col justify-center p-2 border-r-2 border-slate-800">
                                    <h2 className="text-sm font-bold uppercase tracking-wide">PLANO DE INSPEÇÃO: {chk.nome}</h2>
                                    <h3 className="text-[10px] font-semibold text-slate-600 uppercase">Equipamento: {maquina.nome}</h3>
                                </div>
                                <div className="w-1/4 flex flex-col justify-center text-[10px] font-bold p-2 bg-white">
                                    <div className="border-b border-slate-400 pb-1 mb-1">FREQ: {chk.tipo}</div>
                                    <div>RESP: {chk.responsavel}</div>
                                </div>
                            </div>

                            <table className="w-full border-collapse border-2 border-slate-800 text-[11px]">
                                <thead>
                                    <tr className="bg-slate-200">
                                        <th className="border border-slate-800 p-2 w-8 text-center">Nº</th>
                                        <th className="border border-slate-800 p-2 text-left">Ponto de Verificação / Tarefa</th>
                                        <th className="border border-slate-800 p-2 w-24 text-center">Referência</th>
                                        <th className="border border-slate-800 p-2 w-12 text-center">OK</th>
                                        <th className="border border-slate-800 p-2 w-12 text-center">NOK</th>
                                        <th className="border border-slate-800 p-2 w-12 text-center">N/A</th>
                                        <th className="border border-slate-800 p-2 w-48 text-left">Observações do Inspetor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length > 0 ? (
                                        items.map((item, itemIdx) => (
                                            <tr key={itemIdx} className="print-break-inside-avoid">
                                                <td className="border border-slate-800 p-2 text-center font-bold">{itemIdx + 1}</td>
                                                <td className="border border-slate-800 p-2">
                                                    <span className="font-bold uppercase">{item.nome_tarefa}</span>
                                                    {item.orientacao && <div className="text-[9px] text-slate-600 mt-1">{item.orientacao}</div>}
                                                </td>
                                                <td className="border border-slate-800 p-2 text-center text-[9px] text-slate-500">
                                                    {item.tipo_resposta === 'MEDICAO' ? (
                                                        <span>{item.valor_referencia} {item.unidade_medida} <br/> (±{item.tolerancia})</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="border border-slate-800 p-2 text-center">
                                                    <div className="w-4 h-4 border border-slate-500 mx-auto rounded-sm"></div>
                                                </td>
                                                <td className="border border-slate-800 p-2 text-center">
                                                    <div className="w-4 h-4 border border-slate-500 mx-auto rounded-sm"></div>
                                                </td>
                                                <td className="border border-slate-800 p-2 text-center">
                                                    <div className="w-4 h-4 border border-slate-500 mx-auto rounded-sm"></div>
                                                </td>
                                                <td className="border border-slate-800 p-2">
                                                    {item.tipo_resposta === 'MEDICAO' ? (
                                                        <div className="border-b border-dotted border-slate-400 w-full h-4 relative">
                                                            <span className="absolute -top-1 left-0 text-[8px] text-slate-400">Leitura: _______ {item.unidade_medida}</span>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="border border-slate-800 p-4 text-center italic text-slate-500">Nenhum item configurado para este checklist.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* SIGNATURE BLOCK */}
                            <div className="mt-4 border-2 border-slate-800 flex print-break-inside-avoid text-xs">
                                <div className="w-1/2 border-r-2 border-slate-800 p-3">
                                    <div className="font-bold mb-6">Data de Execução: _____/_____/_______</div>
                                    <div className="border-t border-slate-800 pt-1 text-center font-bold uppercase mt-12 w-4/5 mx-auto">
                                        Assinatura do Inspetor / {chk.responsavel}
                                    </div>
                                </div>
                                <div className="w-1/2 p-3">
                                    <div className="font-bold mb-6 text-slate-500">Visto Supervisão (Opcional): _____/_____/_______</div>
                                    <div className="border-t border-slate-800 pt-1 text-center font-bold uppercase mt-12 w-4/5 mx-auto">
                                        Assinatura do Responsável
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="border-2 border-slate-800 rounded-sm p-8 text-center print-break-inside-avoid">
                    <h3 className="font-bold text-lg uppercase text-slate-400">Nenhum Plano de Inspeção Associado</h3>
                    <p className="text-xs text-slate-500 mt-2">Vincule modelos de checklist ao equipamento para gerá-los neste relatório.</p>
                </div>
            )}
        </div>
    );
});

export default FichaTecnicaMaquinaPrint;
