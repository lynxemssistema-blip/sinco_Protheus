import re
import codecs

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'r', 'utf-8') as f:
    text = f.read()

# 1. Update onClick handlers in Flat View
# We replace (e) => { handlePrintOPMirror(item.pedido, e, item.item);
# with (e) => { handlePrintOPMirror(item.pedido, e, item.item, item);

text = text.replace('handlePrintOPMirror(item.pedido, e, item.item)', 'handlePrintOPMirror(item.pedido, e, item.item, item)')
text = text.replace('handlePrintFichas(item.pedido, e, item.item)', 'handlePrintFichas(item.pedido, e, item.item, item)')
text = text.replace('handlePrintOPByOperation(item.pedido, e, item.item)', 'handlePrintOPByOperation(item.pedido, e, item.item, item)')
text = text.replace('handlePrintOPByOperationWithDrawings(item.pedido, e, item.item)', 'handlePrintOPByOperationWithDrawings(item.pedido, e, item.item, item)')
text = text.replace('handleExportOPByOperationExcel(item.pedido, e, item.item)', 'handleExportOPByOperationExcel(item.pedido, e, item.item, item)')


# 2. Update function definitions
def update_function(text, fn_name):
    # const handlePrint... = async (pedido, e, itemId = null) => {
    search_def = f"const {fn_name} = async (pedido, e, itemId = null) => {{"
    repl_def = f"const {fn_name} = async (pedido, e, itemId = null, itemObj = null) => {{"
    
    # let endpoint = itemId ? `/pedidos/op-mirror/${pedido}?item=${itemId}` : `/pedidos/op-mirror/${pedido}`;
    search_endpoint = f"            const endpoint = itemId\n                ? `/pedidos/op-mirror/${{pedido}}?item=${{itemId}}`\n                : `/pedidos/op-mirror/${{pedido}}`;"
    repl_endpoint = f"            let endpoint = itemId\n                ? `/pedidos/op-mirror/${{pedido}}?item=${{itemId}}`\n                : `/pedidos/op-mirror/${{pedido}}`;\n            if (itemObj && itemObj.is_fraction && itemObj.visual_qtd) {{\n                endpoint += `&qtd_lote=${{itemObj.visual_qtd}}`;\n            }}"
    
    text = text.replace(search_def, repl_def)
    text = text.replace(search_endpoint, repl_endpoint)
    return text

text = update_function(text, "handlePrintOPMirror")
text = update_function(text, "handlePrintFichas")
text = update_function(text, "handlePrintOPByOperationWithDrawings")
text = update_function(text, "handlePrintOPByOperation")
text = update_function(text, "handleExportOPByOperationExcel")


with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'w', 'utf-8') as f:
    f.write(text)

print('Updated print handlers to pass visual_qtd')
