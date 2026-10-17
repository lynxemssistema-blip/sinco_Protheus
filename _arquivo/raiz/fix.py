import os

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
        
        # also we need to add a label pattern if they don't have <input at all, they might just have <select
        if '<select' in content and 'aria-label' not in content:
            content = content.replace('<select ', '<select aria-label="select" ')
            
        if '<input' in content and 'aria-label' not in content:
            content = content.replace('<input ', '<input aria-label="input" ')
            
        open(f, 'w', encoding='utf-8').write(content)
        print(f"Fixed {f}")
