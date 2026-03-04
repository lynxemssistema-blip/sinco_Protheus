
import os

production_js_path = r'c:\Users\adm\Desktop\MetalFisa Anty\server\routes\production.js'
fix_code_path = r'c:\Users\adm\Desktop\MetalFisa Anty\server\evolution_endpoint_fix.js'

# Read Fix Code
with open(fix_code_path, 'r', encoding='utf-8') as f:
    fix_code = f.read()

# Read Production JS
with open(production_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define start and end markers of the endpoint to replace
start_marker = "// GET /api/production/pedidos-evolution - Evolução de Pedidos/Itens com Percentuais"
end_marker = "// GET /api/production/appointments/:op - Get Detailed History"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    print(f"Found endpoint block from index {start_idx} to {end_idx}")
    
    # Construct new content used fixes
    new_content = content[:start_idx] + fix_code + "\n\n" + content[end_idx:]
    
    # Write back
    with open(production_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced tracking-evolution endpoint with Fix code.")
else:
    print("Could not find endpoint markers.")
    print(f"Start found: {start_idx}, End found: {end_idx}")
