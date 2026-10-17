import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add aiModel state
state_match = "    const [aiPrompt, setAiPrompt] = useState('');"
state_repl = "    const [aiPrompt, setAiPrompt] = useState('');\n    const [aiModel, setAiModel] = useState('gemini-2.5-flash');"
c = c.replace(state_match, state_repl)

# 2. Update handleAskAI
post_match = '''            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: selectedText,
                prompt: aiPrompt
            });'''
post_repl = '''            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: selectedText,
                prompt: aiPrompt,
                modelName: aiModel
            });'''
c = c.replace(post_match, post_repl)

# 3. Add UI Dropdown
ui_match = '''                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-bold text-sm">Assistente ISO 9001</h2>
                                <p className="text-[10px] text-indigo-100 opacity-90">Powered by Gemini AI</p>
                            </div>
                        </div>'''
ui_repl = '''                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
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
c = c.replace(ui_match, ui_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("done")
