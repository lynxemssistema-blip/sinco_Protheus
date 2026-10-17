import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    doc_code = f.read()

old_suneditor = """                        <SunEditor 
                            setContents={content}
                            onChange={setContent}
                            setOptions={{"""

new_suneditor = """                        <SunEditor 
                            setContents={content}
                            onChange={setContent}
                            onMouseUp={(e, core) => {
                                const sel = window.getSelection();
                                if (sel && sel.toString().trim()) {
                                    setSelectedText(sel.toString());
                                }
                            }}
                            onKeyUp={(e, core) => {
                                const sel = window.getSelection();
                                if (sel && sel.toString().trim()) {
                                    setSelectedText(sel.toString());
                                }
                            }}
                            setOptions={{"""

doc_code = doc_code.replace(old_suneditor, new_suneditor)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(doc_code)

print("SunEditor selectedText capture added.")
