import re
import codecs

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'r', 'utf-8') as f:
    text = f.read()

batch_handler = """
    const handleBatchPrintOPByOperation = async () => {
        if (selectedFractions.size === 0) {
            alert('Selecione pelo menos uma OP para imprimir.');
            return;
        }
        
        if (!confirm(`Deseja imprimir ${selectedFractions.size} OPs selecionadas?`)) return;

        try {
            const { generateOPByOperationPdf } = await import('../services/opByOperationPdfGenerator');
            
            // Collect metadata for each selected fraction
            for (const fraction_id of selectedFractions) {
                const fraction = flattenedFractionalOrders.find(f => f.fraction_id === fraction_id);
                if (!fraction) continue;
                
                setPrintingOrderId(`batch-${fraction_id}`);
                
                let endpoint = `/pedidos/op-mirror/${fraction.pedido}?item=${fraction.item}`;
                if (fraction.is_fraction && fraction.visual_qtd) {
                    endpoint += `&qtd_lote=${fraction.visual_qtd}`;
                }
                
                const response = await api.get(endpoint);
                const mirrorData = response.data;
                // Add a visual tag to the mirrorData title so the PDF knows it was a fraction
                if (fraction.is_fraction) {
                    if (mirrorData.header_info) {
                        mirrorData.header_info.op_original = mirrorData.header_info.op_num;
                        mirrorData.header_info.op_num = fraction.visual_op;
                    }
                }
                generateOPByOperationPdf(mirrorData);
            }
            alert('Impressão em lote concluída com sucesso!');
        } catch (error) {
            console.error('Erro na impressão em lote:', error);
            alert(`Erro na impressão em lote: ${error.message}`);
        } finally {
            setPrintingOrderId(null);
        }
    };
"""

# Insert handler before handlePrintOPMirror
text = text.replace("    const handlePrintOPMirror = async", batch_handler + "\n    const handlePrintOPMirror = async")

# Add button to top bar near PDF export
search_btn = """                        <button
                            type="button"
                            onClick={handleDownloadPDF}"""
repl_btn = """                        <button
                            type="button"
                            onClick={handleBatchPrintOPByOperation}
                            disabled={selectedFractions.size === 0 || printingOrderId?.startsWith('batch-')}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            title="Imprimir OPs"
                        >
                            <Printer className="h-4 w-4" />
                            <span className="hidden xl:inline">Lote ({selectedFractions.size})</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPDF}"""
text = text.replace(search_btn, repl_btn)

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'w', 'utf-8') as f:
    f.write(text)

print('Added batch print logic and button.')
