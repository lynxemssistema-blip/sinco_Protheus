import os

filepath = r"c:\Users\lynx\Documents\MetalFisa Anty\server\services\faturamentoCron.js"
try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update processDailyReport
    content = content.replace(
        "async function processDailyReport(users) {",
        "async function processDailyReport(users, waActive = true, emailActive = true) {"
    )
    content = content.replace(
        "if (userConfig.whatsapp && dbUser.telefone) {",
        "if (userConfig.whatsapp && dbUser.telefone && waActive) {"
    )
    content = content.replace(
        "if (userConfig.email && dbUser.email && transporter) {",
        "if (userConfig.email && dbUser.email && transporter && emailActive) {"
    )

    # 2. Update processComprasReport
    content = content.replace(
        "async function processComprasReport(users) {",
        "async function processComprasReport(users, waActive = true, emailActive = true) {"
    )
    content = content.replace(
        "if (userConfig.whatsapp && dbUser.whatsapp && waMsg) {",
        "if (userConfig.whatsapp && dbUser.whatsapp && waMsg && waActive) {"
    )
    
    # 3. Update processMonthlyAccumulatedReport
    content = content.replace(
        "async function processMonthlyAccumulatedReport(users) {",
        "async function processMonthlyAccumulatedReport(users, waActive = true, emailActive = true) {"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Successfully updated {filepath}")
except Exception as e:
    print(f"Error processing {filepath}: {e}")
