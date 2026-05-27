import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Import HelpCircle and useHelp
if 'HelpCircle' not in c:
    c = c.replace('import { \n    FileText,', 'import { \n    FileText,\n    HelpCircle,')

if 'useHelp' not in c:
    c = re.sub(r"(import api from '../../services/api';)", r"\1\nimport { useHelp } from '../../contexts/HelpContext';", c)

# 2. Add openHelp to SGQDocuments
if 'const { openHelp } = useHelp();' not in c:
    c = c.replace('const [searchParams] = useSearchParams();', 'const [searchParams] = useSearchParams();\n    const { openHelp } = useHelp();')

# 3. Add Help button to header
help_btn = '''                        <button
                            className={`p-2 rounded transition-colors flex items-center gap-2 text-sm font-semibold ${isAIOpen ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            onClick={() => setIsAIOpen(!isAIOpen)}
                        >
                            <Bot className="h-5 w-5" />
                            Assistente IA
                        </button>
                        
                        <button
                            className="p-2 text-slate-500 hover:text-amber-600 transition-colors flex items-center gap-2 text-sm font-semibold hover:bg-amber-50 rounded"
                            onClick={() => openHelp('/sgq/documentos')}
                            title="Ajuda e Treinamento SGQ"
                        >
                            <HelpCircle className="h-5 w-5" />
                            Ajuda
                        </button>'''

c = c.replace('''                        <button
                            className={`p-2 rounded transition-colors flex items-center gap-2 text-sm font-semibold ${isAIOpen ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            onClick={() => setIsAIOpen(!isAIOpen)}
                        >
                            <Bot className="h-5 w-5" />
                            Assistente IA
                        </button>''', help_btn)

# 4. Add X button to AI Assistant
x_btn_match = '''                            <div className="flex-1">
                                <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                                <select 
                                    value={aiModel} 
                                    onChange={(e) => setAiModel(e.target.value)}
                                    className="mt-1 text-[10px] bg-indigo-700 text-indigo-100 border-none rounded outline-none w-full p-1 cursor-pointer font-medium appearance-none"
                                >
                                    <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Rápido)</option>
                                    <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro (Avançado)</option>
                                    <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Legado)</option>
                                </select>
                            </div>
                        </div>'''

x_btn_repl = '''                            <div className="flex-1">
                                <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                                <select 
                                    value={aiModel} 
                                    onChange={(e) => setAiModel(e.target.value)}
                                    className="mt-1 text-[10px] bg-indigo-700 text-indigo-100 border-none rounded outline-none w-full p-1 cursor-pointer font-medium appearance-none"
                                >
                                    <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Rápido)</option>
                                    <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro (Avançado)</option>
                                    <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Legado)</option>
                                </select>
                            </div>
                            <button 
                                onClick={() => setIsAIOpen(false)}
                                className="p-1 hover:bg-white/20 rounded text-white transition-colors self-start"
                                title="Fechar Assistente"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>'''

c = c.replace(x_btn_match, x_btn_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Documentos.jsx updated successfully!")
