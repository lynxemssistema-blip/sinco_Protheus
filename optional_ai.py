import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update handleAskAI to not auto-insert
old_ask_ai = '''    const handleAskAI = async () => {
        if (!aiPrompt.trim()) return;

        const newHistory = [...aiHistory, { role: 'user', text: aiPrompt }];
        setAiHistory(newHistory);
        setAiLoading(true);

        try {
            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: selectedText,
                prompt: aiPrompt,
                modelName: aiModel
            });

            const suggestion = res.data.suggestion;

            setAiHistory(prev => [...prev, { role: 'ai', text: suggestion }]);

            // If user has text selected, replace it, else append at end.
            if (selectedText && selectedText.length > 0) {
                setContent(prev => {
                    // Tenta substituir o texto exato se for encontrado no HTML bruto
                    if (prev.includes(selectedText)) {
                        return prev.replace(selectedText, suggestion);
                    }
                    // Se não encontrar (devido a tags HTML invisíveis), adiciona ao final
                    return prev + `<br/>${suggestion}`;
                });
            } else {
                setContent(prev => prev + `<br/>${suggestion}`);
            }
            setAiPrompt('');
            setSelectedText('');

        } catch (error) {'''

new_ask_ai = '''    const handleAskAI = async () => {
        if (!aiPrompt.trim()) return;

        const currentSelectedText = selectedText;
        const newHistory = [...aiHistory, { role: 'user', text: aiPrompt, targetText: currentSelectedText }];
        setAiHistory(newHistory);
        setAiLoading(true);

        try {
            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: currentSelectedText,
                prompt: aiPrompt,
                modelName: aiModel
            });

            const suggestion = res.data.suggestion;

            setAiHistory(prev => [...prev, { 
                role: 'ai', 
                text: suggestion,
                targetText: currentSelectedText 
            }]);

            // DO NOT auto insert. Let user choose via UI.
            setAiPrompt('');
            setSelectedText('');

        } catch (error) {'''

c = c.replace(old_ask_ai, new_ask_ai)


# 2. Update the Chat UI to add the Accept button
old_chat = '''                        {aiHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }} />
                                </div>
                            </div>
                        ))}'''

new_chat = '''                        {aiHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[90%] rounded-xl p-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none flex flex-col gap-2'}`}>
                                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }} />
                                    {msg.role === 'ai' && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                                            <button 
                                                onClick={() => {
                                                    if (msg.targetText && content.includes(msg.targetText)) {
                                                        setContent(content.replace(msg.targetText, msg.text));
                                                    } else {
                                                        setContent(content + `<br/>${msg.text}`);
                                                    }
                                                }}
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Check className="h-3 w-3" />
                                                {msg.targetText ? 'Aceitar e Substituir' : 'Inserir no Texto'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}'''

c = c.replace(old_chat, new_chat)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("optional usage added")
