import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add Imprimir button
export_btn = '''                        <button
                            onClick={handleExportWord}
                            className="p-2 text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-2 text-sm font-semibold"
                            title="Exportar Word"
                        >
                            <FileDown className="h-5 w-5" />
                            Exportar
                        </button>'''

print_btn = '''                        <button
                            onClick={() => window.print()}
                            className="p-2 text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2 text-sm font-semibold"
                            title="Imprimir / Gerar PDF"
                        >
                            <FileDown className="h-5 w-5" />
                            PDF / Imprimir
                        </button>
''' + export_btn

code = code.replace(export_btn, print_btn)

# 2. Add print:hidden to aside and header
code = code.replace('<aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10">', '<aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 print:hidden">')
code = code.replace('<div aria-label="header" className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">', '<div aria-label="header" className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">')

# 3. Add print optimization to .sgq-document-content
content_div = '<div className="sgq-document-content w-[210mm] min-h-[297mm] bg-white shadow-2xl border border-slate-300 relative group flex flex-col mb-12">'
new_content_div = '<div className="sgq-document-content w-[210mm] min-h-[297mm] bg-white shadow-2xl border border-slate-300 relative group flex flex-col mb-12 print:shadow-none print:border-none print:w-full print:h-full print:m-0">'
code = code.replace(content_div, new_content_div)

# 4. Hide SunEditor toolbar on print in CSS
style_tag = '''                        .se-container { z-index: 10 !important; }
                        `'''
new_style_tag = '''                        .se-container { z-index: 10 !important; }
                        @media print {
                            .se-toolbar { display: none !important; }
                            .se-wrapper-inner { padding: 0 !important; background-image: none !important; }
                            body { background: white !important; }
                            .sgq-document-content { margin: 0 !important; border: none !important; box-shadow: none !important; }
                            aside, header, [aria-label="header"] { display: none !important; }
                        }
                        `'''
code = code.replace(style_tag, new_style_tag)

# 5. Fix absolute container flex to allow print
main_flex = '<main className="flex-1 flex flex-col min-w-0 bg-slate-200/50 overflow-hidden relative">'
new_main_flex = '<main className="flex-1 flex flex-col min-w-0 bg-slate-200/50 overflow-hidden relative print:overflow-visible print:bg-white">'
code = code.replace(main_flex, new_main_flex)

page_container = '<div className="h-screen flex bg-slate-100 font-sans text-slate-800">'
new_page_container = '<div className="h-screen flex bg-slate-100 font-sans text-slate-800 print:h-auto print:bg-white">'
code = code.replace(page_container, new_page_container)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Print optimizations complete')
