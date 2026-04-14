import re
import codecs

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'r', 'utf-8') as f:
    text = f.read()

# 1. Row mapping
search_row = """orders.map((item, idx) => (
                                                <tr key={`${item.pedido}-${item.item}-${idx}`} className={`transition-colors border-b border-gray-50 last:border-0 ${parseFloat(item.qtd_faturar) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'bg-white hover:bg-slate-50'}`}>
                                                    <td className="px-4 py-2 whitespace-nowrap">"""

repl_row = """flattenedFractionalOrders.map((item, idx) => (
                                                <tr key={item.fraction_id} className={`transition-colors border-b border-gray-50 last:border-0 ${parseFloat(item.qtd_faturar) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'bg-white hover:bg-slate-50'} ${selectedFractions.has(item.fraction_id) ? 'bg-blue-50/60' : ''}`}>
                                                    <td className="px-4 py-2 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            checked={selectedFractions.has(item.fraction_id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelection(item.fraction_id); }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap">"""

text = text.replace(search_row, repl_row)

# 2. Header
search_hdr = """) : (
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Pedido</th>"""

repl_hdr = """) : (
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={flattenedFractionalOrders.length > 0 && selectedFractions.size === flattenedFractionalOrders.length}
                                                onChange={toggleAll}
                                            />
                                        </th>
                                        <th className="px-4 py-3 font-semibold">Pedido</th>"""

text = text.replace(search_hdr, repl_hdr)

# 3. OP Display
text = text.replace('{item.op_num || \'-\'}</td>', '{item.visual_op || \'-\'}</td>')

# 4. Quantity Display
text = text.replace(
    "{parseFloat(item.quantidade || 0).toLocaleString('pt-BR')}</td>",
    "{item.visual_qtd ? parseFloat(item.visual_qtd).toLocaleString('pt-BR') : parseFloat(item.quantidade || 0).toLocaleString('pt-BR')}</td>"
)

# 5. Date Display (item.entrega -> item.visual_data)
# Let's replace the td that renders item.entrega
# <Calendar className="h-3 w-3 text-blue-400" />\n{item.entrega ? item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}
search_date = """<Calendar className="h-3 w-3 text-blue-400" />
                                                        {item.entrega ? item.entrega.replace(/(\\d{4})(\\d{2})(\\d{2})/, '$3/$2/$1') : '-'}
                                                    </td>"""

repl_date = """<Calendar className="h-3 w-3 text-blue-400" />
                                                        {item.visual_data ? new Date(item.visual_data).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : (item.entrega ? item.entrega.replace(/(\\d{4})(\\d{2})(\\d{2})/, '$3/$2/$1') : '-')}
                                                    </td>"""
text = text.replace(search_date, repl_date)

with codecs.open('c:/Users/adm/Desktop/MetalFisa Anty/client/src/pages/GestaoOPsPage.jsx', 'w', 'utf-8') as f:
    f.write(text)

print('Done applying table updates via script')
