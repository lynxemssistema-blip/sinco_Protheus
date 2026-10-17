import re

with open('client/src/components/ProcessMappingForm.jsx', 'r', encoding='utf-8') as f:
    code = f.read()
# this is a dummy, I want to edit Documentos.jsx

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    doc_code = f.read()

old_ai_logic = """            // If user has text selected, automatically replace it, else append at end.
            if (quillRef.current) {
                const editor = quillRef.current.getEditor();
                if (selectionRange && selectionRange.length > 0) {
                    // Replace selection 
                    editor.clipboard.dangerouslyPasteHTML(selectionRange.index, suggestion);
                    editor.deleteText(selectionRange.index + suggestion.length, selectionRange.length);
                    editor.setSelection(selectionRange.index + suggestion.length, 0); // Move cursor
                } else {
                    // Append at the cursor or end of document
                    const range = editor.getSelection();
                    const index = range ? range.index : editor.getLength();
                    editor.clipboard.dangerouslyPasteHTML(index, `<br/>${suggestion}`);
                }
            }"""

new_ai_logic = """            // If user has text selected, replace it, else append at end.
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
            setSelectedText('');"""

doc_code = doc_code.replace(old_ai_logic, new_ai_logic)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(doc_code)

print("AI Logic fixed for SunEditor.")
