import sys

path = r'c:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\vmi\DemandaVMIPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "'Rev. Cliente':       r.rev_cliente || '',",
    "'Rev. Cliente':       r.rev_cliente || '',\n                'Rev. Metalfisa':     r.rev_metalfisa || '',"
)

c = c.replace(
    "'Rev.': '', 'Tipo':",
    "'Rev.': '', 'Rev. Metalfisa': '', 'Tipo':"
)

c = c.replace(
    "'Rev.': r.rev_cliente || '', \n                    'Tipo': r.status_tipo_item || 'PCP',",
    "'Rev.': r.rev_cliente || '', \n                    'Rev. Metalfisa': r.rev_metalfisa || '',\n                    'Tipo': r.status_tipo_item || 'PCP',"
)

c = c.replace(
    '<td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || \'-\'}</td>',
    '<td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || \'-\'}</td>\n                <td className="px-4 py-2 text-[11px] font-bold text-indigo-600">{r.rev_metalfisa || \'-\'}</td>'
)

c = c.replace(
    "{renderHeader('rev_cliente', 'Rev.', 'min-w-[60px]')}",
    "{renderHeader('rev_cliente', 'Rev.', 'min-w-[60px]')}\n                                    {renderHeader('rev_metalfisa', 'Rev. Metalfisa', 'min-w-[60px]')}"
)

c = c.replace(
    '<td className="px-2 py-1"><input type="text" value={columnFilters.rev_cliente} onChange={e => setColumnFilters({...columnFilters, rev_cliente: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Rev..." /></td>',
    '<td className="px-2 py-1"><input type="text" value={columnFilters.rev_cliente} onChange={e => setColumnFilters({...columnFilters, rev_cliente: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Rev..." /></td>\n                                        <td className="px-2 py-1"><input type="text" value={columnFilters.rev_metalfisa} onChange={e => setColumnFilters({...columnFilters, rev_metalfisa: e.target.value})} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Rev. Metalfisa..." /></td>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Done!')
