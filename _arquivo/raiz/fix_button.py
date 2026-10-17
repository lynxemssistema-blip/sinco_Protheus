import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

new_suneditor = '''                        <SunEditor 
                            setContents={content}
                            onChange={setContent}
                            setOptions={{'''

c = re.sub(r'<SunEditor\s+setContents={content}\s+onChange={\(content\).*?setOptions={{', new_suneditor, c, flags=re.DOTALL)

old_sidebar_header = '''                    <div className="p-4 border-b border-slate-100 bg-indigo-600 text-white flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Bot className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                            <p className="text-[10px] text-indigo-100 opacity-90">Powered by Gemini AI</p>
                        </div>
                    </div>'''

new_sidebar_header = '''                    <div className="p-4 border-b border-slate-100 bg-indigo-600 text-white flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                                <p className="text-[10px] text-indigo-100 opacity-90">Powered by Gemini AI</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                const sel = window.getSelection();
                                const text = sel ? sel.toString().trim() : '';
                                if (text) setSelectedText(text);
                                else alert('Nenhum texto selecionado no editor!');
                            }}
                            className="w-full py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-bold rounded flex items-center justify-center gap-2 transition-colors border border-indigo-400"
                            title="Puxar o texto que está selecionado no documento"
                        >
                            Capturar Texto Selecionado
                        </button>
                    </div>'''

c = c.replace(old_sidebar_header, new_sidebar_header)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("done")
