import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

btn_logic_match = '''                                                onClick={() => {
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

btn_logic_repl = '''                                                onClick={() => {
                                                    if (sunEditorRef.current) {
                                                        if (msg.targetText) {
                                                            // Se existe no HTML puro, substitui direto
                                                            if (content.includes(msg.targetText)) {
                                                                setContent(content.replace(msg.targetText, msg.text));
                                                            } else {
                                                                // Truque: Procura o texto na tela para forçar a seleção no SunEditor
                                                                // e então injeta em cima da seleção.
                                                                // Limpa seleção atual primeiro para garantir que find procure do início
                                                                window.getSelection().removeAllRanges();
                                                                const found = window.find(msg.targetText, false, false, true, false, false, false);
                                                                if (found) {
                                                                    sunEditorRef.current.insertHTML(msg.text, true, true);
                                                                } else {
                                                                    sunEditorRef.current.insertHTML(msg.text, true, true);
                                                                }
                                                            }
                                                        } else {
                                                            sunEditorRef.current.insertHTML(msg.text, true, true);
                                                        }
                                                    } else {
                                                        setContent(content + `<br/>${msg.text}`);
                                                    }
                                                }}'''

c = c.replace(btn_logic_match, btn_logic_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("find logic added")
