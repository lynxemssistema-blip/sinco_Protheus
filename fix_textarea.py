import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix setAiPrompt to clear immediately
handle_ask_match = '''        const newHistory = [...aiHistory, { role: 'user', text: displayPrompt, targetText: currentSelectedText }];
        setAiHistory(newHistory);
        setAiLoading(true);

        try {
            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: currentSelectedText,
                prompt: aiPrompt,
                modelName: aiModel,
                extraContext: aiContextText
            });'''

handle_ask_repl = '''        const newHistory = [...aiHistory, { role: 'user', text: displayPrompt, targetText: currentSelectedText }];
        setAiHistory(newHistory);
        setAiLoading(true);
        // Salva as variáveis locais para a chamada da API e limpa a tela pro usuário
        const promptToSend = aiPrompt;
        setAiPrompt('');
        setSelectedText('');

        try {
            const res = await api.post('/ai/document-assist', {
                documentContext: content,
                selectedText: currentSelectedText,
                prompt: promptToSend,
                modelName: aiModel,
                extraContext: aiContextText
            });'''

c = c.replace(handle_ask_match, handle_ask_repl)

# We also need to remove setAiPrompt('') and setSelectedText('') from after the try block since it's already cleared
clean_match = '''            // DO NOT auto insert. Let user choose via UI.
            setAiPrompt('');
            setSelectedText('');

        } catch (error) {'''

clean_repl = '''            // DO NOT auto insert. Let user choose via UI.

        } catch (error) {'''

c = c.replace(clean_match, clean_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("UX bug fixed in AI handler")
