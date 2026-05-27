import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

css_match = '''                        .sun-editor { border: none !important; }
                        .se-resizing-bar { display: none !important; }'''

css_repl = '''                        .sun-editor { border: none !important; }
                        .se-resizing-bar { display: none !important; }
                        .se-toolbar {
                            position: sticky !important;
                            top: 0 !important;
                            z-index: 50 !important;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
                            background-color: #f8fafc !important;
                            border-bottom: 1px solid #e2e8f0 !important;
                        }'''

c = c.replace(css_match, css_repl)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("sticky toolbar applied")
