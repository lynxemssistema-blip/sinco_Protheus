
import os

production_js_path = r'c:\Users\adm\Desktop\MetalFisa Anty\server\routes\production.js'
v2_code_path = r'c:\Users\adm\Desktop\MetalFisa Anty\server\comparison_endpoint_v2.js'

# Read V2 Code
with open(v2_code_path, 'r', encoding='utf-8') as f:
    v2_code = f.read()

# Read Production JS
with open(production_js_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define start and end markers of the endpoint to replace
start_marker = "// GET /api/production/tracking-comparison - Compare Planned vs Tracked Production"
end_marker = "// GET /api/production/analytics-dashboard - Production Analytics Dashboard"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    print(f"Found endpoint block from index {start_idx} to {end_idx}")
    
    # Construct new content
    new_content = content[:start_idx] + v2_code + "\n\n" + content[end_idx:]
    
    # Write back
    with open(production_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully replaced endpoint with V2 code.")
else:
    print("Could not find endpoint markers.")
    print(f"Start found: {start_idx}, End found: {end_idx}")
