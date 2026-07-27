import os

def replace_in_file(filepath, replacements):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                modified = True
            else:
                print(f"Warning: Could not find block in {filepath}")
                print(f"Block: {old[:50]}...")
                
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Successfully updated {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

# 1. faturamentoCron.js
faturamentoCron_path = r"c:\Users\lynx\Documents\MetalFisa Anty\server\services\faturamentoCron.js"
faturamentoCron_replacements = [
    (
        "if (config?.automations?.relatorios_faturamento_active === false) {",
        "if (config?.automations?.relatorios_faturamento_active === false && config?.automations?.relatorios_faturamento_email_active === false) {"
    ),
    (
        "// Tenta disparar para o WhatsApp se estiver na config",
        "const waActive = config?.automations?.relatorios_faturamento_active !== false;\n            const emailActive = config?.automations?.relatorios_faturamento_email_active !== false;\n\n            // Tenta disparar para o WhatsApp se estiver na config"
    ),
    (
        "if (userConfig.whatsapp && dbUser.whatsapp && waMsg) {",
        "if (userConfig.whatsapp && dbUser.whatsapp && waMsg && waActive) {"
    ),
    (
        "// Email",
        "// Email"
    ),
    (
        "if (userConfig.email && dbUser.email && transporter) {",
        "if (userConfig.email && dbUser.email && transporter && emailActive) {"
    )
]

# Note: faturamentoCron.js has 3 functions (processDailyReport, processComprasReport, processMonthlyAccumulatedReport). 
# All 3 of them have `if (userConfig.whatsapp` and `if (userConfig.email`. 
# We need to make sure `waActive` and `emailActive` are available in those functions, OR we can just read them from DB inside each function.
# Wait, the `config` is read at the top of the cron but not passed to `processDailyReport`!
# Ah! `processDailyReport(autoConfig.users)` doesn't have `config` passed. It fetches its own `general_config`? Let's check.
