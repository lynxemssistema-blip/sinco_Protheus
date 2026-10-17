import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Remove the old help button we added in the header
old_help_btn = '''                        <button
                            className="p-2 text-slate-500 hover:text-amber-600 transition-colors flex items-center gap-2 text-sm font-semibold hover:bg-amber-50 rounded"
                            onClick={() => openHelp('/sgq/documentos')}
                            title="Ajuda e Treinamento SGQ"
                        >
                            <HelpCircle className="h-5 w-5" />
                            Ajuda
                        </button>'''
c = c.replace(old_help_btn, '')

# 2. Add HelpDrawer to the imports
if 'HelpDrawer' not in c:
    c = re.sub(r"(import { useHelp } from '../../contexts/HelpContext';)", r"\1\nimport HelpDrawer from '../../components/HelpDrawer';", c)

# 3. Add the floating help button and HelpDrawer to the bottom of the main container
floating_btn_and_drawer = '''
            {/* Help Drawer & Floating Button */}
            <HelpDrawer />
            <button
                onClick={() => openHelp('/sgq/documentos')}
                title="Ajuda desta tela"
                aria-label="Abrir ajuda contextual"
                className="fixed bottom-6 right-6 z-[990] w-12 h-12 rounded-full bg-slate-900 text-white shadow-2xl hover:bg-blue-600 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 print:hidden"
            >
                <HelpCircle className="h-5 w-5" />
            </button>
        </div >
    );
};'''

c = re.sub(r"        </div >\n    \);\n};", floating_btn_and_drawer, c)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Documentos.jsx updated with floating button and drawer!")
