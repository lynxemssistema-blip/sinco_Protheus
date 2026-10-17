import re

with open('client/src/pages/sgq/Documentos.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Find lucide-react import
lucide_match = re.search(r"import\s+{([^}]+)}\s+from\s+['\"]lucide-react['\"];", c)
if lucide_match:
    current_imports = lucide_match.group(1)
    new_imports = current_imports
    
    for icon in ['Paperclip', 'FileUp', 'X']:
        if icon not in current_imports:
            new_imports += f", {icon}"
    
    new_import_line = f"import {{ {new_imports.strip(' ,')} }} from 'lucide-react';"
    c = c.replace(lucide_match.group(0), new_import_line)

with open('client/src/pages/sgq/Documentos.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Icons imported successfully")
