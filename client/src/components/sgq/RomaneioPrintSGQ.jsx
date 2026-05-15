import React from 'react';
import metalfisaLogo from '../../assets/metalfisa-logo.png';

const RomaneioPrintSGQ = React.forwardRef(({ romaneio, items }, ref) => {
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
                        Romaneio de Equipamentos / Instrumentos (SGQ)
                    </div>
                    <div className="w-1/4 p-2 flex flex-col justify-center items-center">
                        <div className="font-bold text-lg">Nº {romaneio.numero}</div>
                        <div className="text-xs">{new Date(romaneio.created_at).toLocaleString()}</div>
                    </div>
                </div>

                {/* Sender Info - Dynamic */}
                <div className="p-2 border-b border-black text-xs">
                    <div className="font-bold uppercase">DADOS DA EMISSÃO / CONTROLE INTERNO</div>
                    <div>Elaborado por: {romaneio.responsavel || 'Sistema SGQ'}</div>
                    <div className="flex gap-4 mt-0.5">
                        <span>Emissão/Envio: {new Date(romaneio.data_envio || romaneio.created_at || Date.now()).toLocaleDateString('pt-BR')}</span>
                        {romaneio.previsao_retorno && (
                            <span>
                                Previsão de Retorno: {new Date(romaneio.previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Client Info */}
                <div className="p-2 flex border-b border-black">
                    <div className="w-full">
                        <div className="font-bold text-xs mb-1">DESTINATÁRIO (LABORATÓRIO / MANUTENÇÃO EXTERNA)</div>
                        <div className="uppercase font-medium text-sm">{romaneio.destinatario || '---'}</div>
                    </div>
                </div>

                {/* Observation */}
                <div className="p-2 min-h-12 text-xs">
                    <span className="font-bold">OBSERVAÇÕES:</span> {romaneio.observacao}
                </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-black mb-8 text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black p-1 text-center w-8">Item</th>
                        <th className="border border-black p-1 text-left w-24">Patrimônio</th>
                        <th className="border border-black p-1 text-left">Nome / Descrição</th>
                        <th className="border border-black p-1 text-left w-32">Modelo</th>
                        <th className="border border-black p-1 text-left w-32">Serial Number</th>
                        <th className="border border-black p-1 text-center w-24">Valid. Calibração</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="border border-black p-1 text-center">{index + 1}</td>
                            <td className="border border-black p-1 font-bold">{item.patrimonio || '-'}</td>
                            <td className="border border-black p-1">{item.name}</td>
                            <td className="border border-black p-1">{item.model || '-'}</td>
                            <td className="border border-black p-1">{item.serial_number || '-'}</td>
                            <td className="border border-black p-1 text-center">
                                {item.calibration_validity ? new Date(item.calibration_validity).toLocaleDateString('pt-BR') : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Signatures */}
            <div className="flex gap-8 mt-16 text-xs">
                <div className="flex-1 text-center border-t border-black pt-2">
                    EMITENTE (SGQ METALFISA)
                </div>
                <div className="flex-1 text-center border-t border-black pt-2">
                    TRANSPORTADOR
                </div>
                <div className="flex-1 text-center border-t border-black pt-2">
                    RECEBEDOR (LABORATÓRIO)
                </div>
            </div>
            <style type="text/css" media="print">
                {`
                 @page { size: portrait; margin: 10mm; }
                 .print-content { display: block; width: 100%; }
                `}
            </style>
        </div>
    );
});

export default RomaneioPrintSGQ;
