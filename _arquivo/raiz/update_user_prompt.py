import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

old_logic = '''        const currentSelectedText = selectedText;
        const newHistory = [...aiHistory, { role: 'user', text: aiPrompt, targetText: currentSelectedText }];'''

new_logic = '''        const currentSelectedText = selectedText;
        const displayPrompt = currentSelectedText ? 
            `<div class="text-[10px] text-indigo-200 mb-1 pb-1 border-b border-indigo-500 italic line-clamp-2">" ${currentSelectedText} "</div>${aiPrompt}` : 
            aiPrompt;
        
        const newHistory = [...aiHistory, { role: 'user', text: displayPrompt, targetText: currentSelectedText }];'''

c = c.replace(old_logic, new_logic)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("added user prompt text")
