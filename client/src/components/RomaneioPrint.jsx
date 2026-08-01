import React from 'react';
import metalfisaLogo from '../assets/metalfisa-logo.png';
import { useAuth } from '../contexts/AuthContext';

const RomaneioPrint = React.forwardRef(({ romaneio, items, nfs, typeDescription }, ref) => {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');

    if (!romaneio) return null;

    return (
        <div ref={ref} className="print-content text-sm bg-white p-8 w-full print:w-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="border border-black mb-4">
                <div className="flex border-b border-black">
                    <div className="w-1/4 p-2 border-r border-black flex items-center justify-center">
                        <img src={metalfisaLogo} alt="MetalFisa" className="max-h-16" />
                    </div>
                    <div className="w-2/4 p-2 text-center uppercase font-bold flex items-center justify-center text-lg border-r border-black">
                        Romaneio de {typeDescription || 'Saída'}
                    </div>
                    <div className="w-1/4 p-2 flex flex-col justify-center items-center">
                        <div className="font-bold text-lg">Nº {romaneio.id}</div>
                        <div className="text-sm">Rev: {romaneio.current_revision || 1}</div>
                        <div className="text-xs">{new Date(romaneio.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                {/* Sender Info - Dynamic */}
                <div className="p-2 border-b border-black text-xs">
                    <div className="font-bold uppercase">DADOS DA EMISSÃO / CONTROLE INTERNO</div>
                    <div>Elaborado por: {romaneio.usuario || 'Sistema'}</div>
                    <div className="flex gap-4 mt-0.5">
                        <span>Emissão: {new Date(romaneio.data_liberacao || romaneio.created_at || Date.now()).toLocaleDateString('pt-BR')}</span>
                        {romaneio.data_previsao_retorno && (
                            <span>
                                Previsão de Retorno: {new Date(romaneio.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Client Info */}
                <div className="p-2 flex border-b border-black">
                    <div className="w-1/2 pr-2 border-r border-black">
                        <div className="font-bold text-xs mb-1">DESTINATÁRIO / CLIENTE</div>
                        <div>{romaneio.cliente_nome} (Loja {romaneio.cliente_loja})</div>
                        <div>{romaneio.cliente_endereco}, {romaneio.cliente_bairro}</div>
                        <div>{romaneio.cliente_cidade} - {romaneio.cliente_uf}, {romaneio.cliente_cep}</div>
                        <div>Tel: {romaneio.cliente_telefone}</div>
                    </div>
                    <div className="w-1/2 pl-2">
                        <div className="font-bold text-xs mb-1">TRANSPORTE E RETORNO</div>
                        <div>Motorista: {romaneio.motorista_nome || '---'}</div>
                        <div>PLACA: {romaneio.veiculo_placa || '---'} - MODELO: {romaneio.veiculo_modelo || '---'}</div>
                    </div>
                </div>

                {nfs && nfs.length > 0 && (
                    <div className="p-2 border-b border-black text-xs bg-gray-50 flex gap-4 items-center justify-center">
                        <div className="font-bold">NOTAS FISCAIS VINCULADAS:</div>
                        <div className="flex gap-4">
                            {nfs.map((nf, i) => (
                                <span key={i} className="bg-gray-200 px-2 py-0.5 rounded border border-gray-300">
                                    <span className="font-bold uppercase mr-1">{nf.tipo_nf}:</span>
                                    {nf.nf_numero}{nf.nf_serie ? `-${nf.nf_serie}` : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Observation */}
                <div className="p-2 min-h-12 text-xs">
                    <span className="font-bold">OBSERVAÇÕES:</span> {romaneio.observacao_geral}
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-black mb-8 text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-1 text-center w-8">Item</th>
                        <th className="border border-black p-1 text-left w-20">Código</th>
                        <th className="border border-black p-1 text-left">Descrição</th>
                        <th className="border border-black p-1 text-left w-24">Ref. (OP/Ped)</th>
                        <th className="border border-black p-1 text-left w-24">Cliente</th>
                        <th className="border border-black p-1 text-right w-16">Peso Unit.</th>
                        <th className="border border-black p-1 text-right w-16">Peso Tot.</th>
                        <th className="border border-black p-1 text-right w-16">Área (m²)</th>
                        <th className="border border-black p-1 text-right w-16">Qtd.</th>
                        {canViewValues && <th className="border border-black p-1 text-right w-16">Vlr. Unit</th>}
                        {canViewValues && <th className="border border-black p-1 text-right w-16">Total</th>}
                        <th className="border border-black p-1 text-left w-24">Obs. Item</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="border border-black p-1 text-center">{index + 1}</td>
                            <td className="border border-black p-1">{item.codigo_produto}</td>
                            <td className="border border-black p-1">{item.descricao_produto}</td>
                            <td className="border border-black p-1">{item.pedido ? `${item.pedido}/${item.item_pedido}` : '-'}</td>
                            <td className="border border-black p-1">{item.pedido ? romaneio.cliente_nome : ''}</td>
                            <td className="border border-black p-1 text-right">{item.peso_kg ? Number(item.peso_kg).toFixed(3) : '-'}</td>
                            <td className="border border-black p-1 text-right font-bold">
                                {item.peso_kg ? (Number(item.peso_kg) * Number(item.quantidade || 0)).toFixed(3) : '-'}
                            </td>
                            <td className="border border-black p-1 text-right">{item.area_pintura_m2 ? Number(item.area_pintura_m2).toFixed(2) : '-'}</td>
                            <td className="border border-black p-1 text-right font-bold">{item.quantidade}</td>
                            {canViewValues && (
                                <td className="border border-black p-1 text-right">
                                    {item.valor_unitario ? Number(item.valor_unitario).toFixed(2) : '0.00'}
                                </td>
                            )}
                            {canViewValues && (
                                <td className="border border-black p-1 text-right font-bold">
                                    {(Number(item.valor_unitario || 0) * Number(item.quantidade || 0)).toFixed(2)}
                                </td>
                            )}
                            <td className="border border-black p-1">{item.comentario}</td>
                        </tr>
                    ))}
                    {/* Sum Totals? User didn't ask, but good for Weight/Area */}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-50 font-bold">
                        <td colSpan="5" className="border border-black p-1 text-right">TOTAIS:</td>
                        <td className="border border-black p-1">{/* Peso Unit */}</td>
                        <td className="border border-black p-1 text-right">
                            {items.reduce((acc, it) => acc + (Number(it.peso_kg || 0) * Number(it.quantidade || 0)), 0).toFixed(3)}
                        </td>
                        <td className="border border-black p-1 text-right">
                            {items.reduce((acc, it) => acc + (Number(it.area_pintura_m2 || 0) * Number(it.quantidade || 0)), 0).toFixed(2)}
                        </td>
                        <td className="border border-black p-1 text-right">
                            {items.reduce((acc, it) => acc + Number(it.quantidade || 0), 0)}
                        </td>
                        {canViewValues && <td className="border border-black p-1">{/* Vlr Unit */}</td>}
                        {canViewValues && (
                            <td className="border border-black p-1 text-right">
                                {items.reduce((acc, it) => acc + (Number(it.valor_unitario || 0) * Number(it.quantidade || 0)), 0).toFixed(2)}
                            </td>
                        )}
                        <td className="border border-black p-1"></td>
                    </tr>
                </tfoot>
            </table>

            {/* Signatures */}
            <div className="flex gap-8 mt-16 text-xs">
                <div className="flex-1 text-center border-t border-black pt-2">
                    EMITENTE
                </div>
                <div className="flex-1 text-center border-t border-black pt-2">
                    TRANSPORTADOR
                </div>
                <div className="flex-1 text-center border-t border-black pt-2">
                    RECEBEDOR
                </div>
            </div>
            <style type="text/css" media="print">
                {`
                 @page { size: landscape; margin: 10mm; }
                 .print-content { display: block; width: 100%; }
                `}
            </style>
        </div>
    );
});

export default RomaneioPrint;
