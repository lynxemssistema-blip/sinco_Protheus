import sys

with open('client/src/services/opByOperationWithDrawingsPdfGenerator.js', 'r', encoding='utf-8') as f:
    code = f.read()

prefix = '''import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import api from './api';
import { generateOrderPDF } from './orderPdfGenerator';

/**
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPByOperationWithDrawingsPdf = async (mirrorData, userName = 'Usuário', batchContext = null) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error('Invalid data provided to PDF generator');
            alert('Dados inválidos para geração do PDF.');
            return;
        }'''

idx_summary = code.find('const partsSummaryMap = new Map();')
idx_espelho = code.find("const espelhoBuffer = doc.output('arraybuffer');")

if idx_summary != -1 and idx_espelho != -1:
    summary_extraction = code[idx_summary:idx_espelho].strip()
    
    inject = '''
        const orderRes = await api.get(`/pedidos/dados/${mirrorData.pedido.pedido}`);
        const orderData = orderRes.data;
        const espelhoBuffer = await generateOrderPDF(orderData, true, batchContext);

        let finalPdf;
        try {
            // Documento destino limpo
            finalPdf = await PDFDocument.create();
'''

    idx_after_espelho = code.find('finalPdf = await PDFDocument.create();', idx_espelho)
    rest_idx = idx_after_espelho + len('finalPdf = await PDFDocument.create();')
    
    rest_of_code = code[rest_idx:].strip()

    # Now we must update the watermark in the rest_of_code
    rest_of_code = rest_of_code.replace(
        "const qtyText = Number(part.qtdTotal).toFixed(4).replace(/\.?0+$/, '');",
        "const qtyText = Number(part.qtdTotal).toFixed(4).replace(/\.?0+$/, '');\n                    const finalQtdStr = batchContext && batchContext.is_fraction && batchContext.visual_qtd ? `${batchContext.visual_qtd} / ${qtyText}` : qtyText;\n                    const visualOpStr = batchContext ? batchContext.visual_op : uniqueOps;"
    )

    rest_of_code = rest_of_code.replace(
        "const textLine1 = `CPIA CONTROLADA | DATA: ${dataGeracao} | USURIO: ${userName}`;",
        "const textLine1 = `CÓPIA CONTROLADA | DATA: ${dataGeracao} | USUÁRIO: ${userName}`;"
    )

    rest_of_code = rest_of_code.replace(
        "const textLine2 = `PEDIDO: ${uniquePedidos} | ITEM: ${uniqueItens} | OP: ${uniqueOps} | QTD NECESSRIA: ${qtyText} ${part.um}`;",
        "const textLine2 = `CÓD: ${part.codigo} | LOTE/OP: ${visualOpStr} | ENTREGA LOTE: ${batchContext && batchContext.data_pcp ? batchContext.data_pcp : '-'} | QTD: ${finalQtdStr} ${part.um}`;"
    )
    
    new_code = prefix + '\n\n        ' + summary_extraction + '\n' + inject + '\n            ' + rest_of_code
    
    with open('client/src/services/opByOperationWithDrawingsPdfGenerator.js', 'w', encoding='utf-8') as f:
        f.write(new_code)
    print('File updated successfully.')
else:
    print('Could not find anchor points.')
