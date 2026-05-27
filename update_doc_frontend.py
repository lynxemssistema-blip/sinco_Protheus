import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Add new states and ref
state_match = "    const [aiModel, setAiModel] = useState('gemini-2.5-flash');"
state_repl = '''    const [aiModel, setAiModel] = useState('gemini-2.5-flash');
    const [aiContextFileName, setAiContextFileName] = useState('');
    const [aiContextText, setAiContextText] = useState('');
    const [aiContextLoading, setAiContextLoading] = useState(false);
    const sunEditorRef = useRef(null);
    const contextFileInputRef = useRef(null);'''
c = c.replace(state_match, state_repl)

# 2. Add SunEditor instance fetcher
sun_editor_match = '''<SunEditor 
                            setContents={content}
                            onChange={setContent}
                            setOptions={{'''
sun_editor_repl = '''<SunEditor 
                            getSunEditorInstance={(editor) => { sunEditorRef.current = editor; }}
                            setContents={content}
                            onChange={setContent}
                            setOptions={{'''
c = c.replace(sun_editor_match, sun_editor_repl)

# 3. Add handleUploadContext
upload_handler = '''    const handleAskAI = async () => {'''
upload_handler_repl = '''    const handleUploadContext = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAiContextFileName(file.name);
        setAiContextLoading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/ai/extract-context', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setAiContextText(res.data.text);
        } catch (error) {
            console.error('Erro ao extrair contexto:', error);
            alert('Falha ao processar o arquivo de contexto.');
            setAiContextFileName('');
        } finally {
            setAiContextLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleAskAI = async () => {'''
c = c.replace(upload_handler, upload_handler_repl)

# 4. Update the ask AI payload
ask_match = '''                selectedText: currentSelectedText,
                prompt: aiPrompt,
                modelName: aiModel
            });'''
ask_repl = '''                selectedText: currentSelectedText,
                prompt: aiPrompt,
                modelName: aiModel,
                extraContext: aiContextText
            });'''
c = c.replace(ask_match, ask_repl)

# 5. Update the "Insert" button to use sunEditorRef.current.insertHTML
chat_btn_match = '''                                                onClick={() => {
                                                    if (msg.targetText && content.includes(msg.targetText)) {
                                                        setContent(content.replace(msg.targetText, msg.text));
                                                    } else {
                                                        setContent(content + `<br/>${msg.text}`);
                                                    }
                                                }}'''
chat_btn_repl = '''                                                onClick={() => {
                                                    if (sunEditorRef.current) {
                                                        if (msg.targetText) {
                                                            // For replacement, we just append if we can't find and replace
                                                            if (content.includes(msg.targetText)) {
                                                                setContent(content.replace(msg.targetText, msg.text));
                                                            } else {
                                                                sunEditorRef.current.insertHTML(msg.text, true, true);
                                                            }
                                                        } else {
                                                            // Insert exactly at current cursor position!
                                                            sunEditorRef.current.insertHTML(msg.text, true, true);
                                                        }
                                                    } else {
                                                        // fallback
                                                        setContent(content + `<br/>${msg.text}`);
                                                    }
                                                }}'''
c = c.replace(chat_btn_match, chat_btn_repl)
btn_label_match = "{msg.targetText ? 'Aceitar e Substituir' : 'Inserir no Texto'}"
btn_label_repl = "{msg.targetText ? 'Substituir Seleção' : 'Inserir no Cursor'}"
c = c.replace(btn_label_match, btn_label_repl)

# 6. Add UI for file context
ui_context = '''                            <textarea
                                rows="3"
                                className="w-full bg-slate-100 border-none rounded-xl pr-12 pl-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Descreva a melhoria desejada..."'''
ui_context_repl = '''                            <div className="mb-2">
                                <input type="file" ref={contextFileInputRef} className="hidden" accept=".pdf,.docx,.doc" onChange={handleUploadContext} />
                                {aiContextFileName ? (
                                    <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 text-[10px] p-2 rounded border border-emerald-200">
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            <FileUp className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate font-medium">{aiContextFileName}</span>
                                        </div>
                                        <button onClick={() => {setAiContextFileName(''); setAiContextText('');}} className="p-1 hover:bg-emerald-100 rounded text-emerald-600"><X className="h-3 w-3" /></button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => contextFileInputRef.current?.click()} 
                                        disabled={aiContextLoading}
                                        className="w-full flex items-center justify-center gap-2 text-[10px] text-slate-500 bg-slate-100 hover:bg-slate-200 py-1.5 rounded transition-colors"
                                    >
                                        {aiContextLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                                        {aiContextLoading ? 'Processando arquivo...' : 'Anexar PDF ou Word como base'}
                                    </button>
                                )}
                            </div>
                            <textarea
                                rows="3"
                                className="w-full bg-slate-100 border-none rounded-xl pr-12 pl-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Ex: Crie um tópico com base no anexo..."'''
c = c.replace(ui_context, ui_context_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("done")
