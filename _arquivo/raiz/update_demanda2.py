import sys

path = r'c:\Users\adm\Desktop\MetalFisa Anty\client\src\pages\vmi\DemandaVMIPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

count = c.count('<td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || \'-\'}</td>')
print(f'Count of remaining rev_cliente matches: {count}')

c = c.replace(
    '<td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || \'-\'}</td>',
    '<td className="px-4 py-2 text-[11px] font-bold text-slate-600">{r.rev_cliente || \'-\'}</td>\n                              <td className="px-4 py-2 text-[11px] font-bold text-indigo-600">{r.rev_metalfisa || \'-\'}</td>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Replaced remaining matches')
