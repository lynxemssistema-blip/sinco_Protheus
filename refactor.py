import re

with open('c:/Users/lynx/Documents/MetalFisa Anty/server/routes/reports.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The extraction target
match = re.search(r'(\s+)(const \{ rows \} = await fetchSalesPlanningData.*?\s+allRecursos = \[\.\.\.recursoSet\]\.sort\(\);\s+\})', content, re.DOTALL)
if not match:
    print("Could not find the block to extract")
    exit(1)

indent, block = match.groups()

# The new function
new_function = f'''
async function loadSalesPlanningDependencies(query) {{
{block}
    return {{ rows, capacidadeMap, recursoNomeMap, allRecursos, bomMap, routingMap }};
}}
'''

# Replace the block with the function call
new_call = "        const { rows, capacidadeMap, recursoNomeMap, allRecursos, bomMap, routingMap } = await loadSalesPlanningDependencies(req.query);"
content = content.replace(block, new_call)

# Insert the function just above the router.get
content = content.replace('// GET /api/reports/sales-planning/excel OR xlsx', new_function + '\n// GET /api/reports/sales-planning/excel OR xlsx')

with open('c:/Users/lynx/Documents/MetalFisa Anty/server/routes/reports.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Refactored successfully")
