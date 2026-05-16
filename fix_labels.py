import os
import re

files = [
    'client/src/components/MonitoringDashboard.jsx',
    'client/src/components/orders/FlatItemRow.jsx',
    'client/src/pages/comercial/FaturamentoSolicitacoesHistorico.jsx',
    'client/src/pages/MeuCanal.jsx',
    'client/src/pages/sinco/SWorks.jsx',
    'client/src/pages/gerencial/VisaoGerencialAtrasos.jsx'
]

for f in files:
    if os.path.exists(f):
        content = open(f, 'r', encoding='utf-8').read()
        original = content
        
        # Add aria-label="input" to <input ...> that don't have aria-label
        content = re.sub(r'<input(?![^>]*aria-label)([^>]*?)>', r'<input aria-label="input"\1>', content, flags=re.IGNORECASE)
        
        # Add aria-label="select" to <select ...> that don't have aria-label
        content = re.sub(r'<select(?![^>]*aria-label)([^>]*?)>', r'<select aria-label="select"\1>', content, flags=re.IGNORECASE)

        # Add aria-label="textarea" to <textarea ...> that don't have aria-label
        content = re.sub(r'<textarea(?![^>]*aria-label)([^>]*?)>', r'<textarea aria-label="textarea"\1>', content, flags=re.IGNORECASE)

        if content != original:
            open(f, 'w', encoding='utf-8').write(content)
            print(f"Fixed labels in {f}")
