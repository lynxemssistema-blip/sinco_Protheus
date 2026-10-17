import os

filepath = r"c:\Users\lynx\Documents\MetalFisa Anty\server\services\cronJobs\faturamentoEmailJob.js"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

bad_block = """        if (emailsConfig && Array.isArray(emailsConfig) && emailsConfig.length > 0) {
            const [userRows] = await mysqlPool.query(
                `SELECT email, whatsapp FROM usuario WHERE idUsuario IN (?) AND (email IS NOT NULL OR whatsapp IS NOT NULL)`,
                [emailsConfig]
            );
                }
            }
        }"""

good_block = """        if (emailsConfig && Array.isArray(emailsConfig) && emailsConfig.length > 0) {
            const [userRows] = await mysqlPool.query(
                `SELECT email, whatsapp FROM usuario WHERE idUsuario IN (?) AND (email IS NOT NULL OR whatsapp IS NOT NULL)`,
                [emailsConfig]
            );
            
            // E-mail
            if (configObj.automations?.visao_gerencial_faturamento_email_active !== false) {
                recipientList = userRows.map(u => u.email).filter(Boolean);
            }

            // WhatsApp
            if (configObj.automations?.visao_gerencial_faturamento_active !== false) {
                const waNumbers = userRows.map(u => u.whatsapp).filter(Boolean);
                if (waNumbers.length > 0) {
                    const waText = msgFaturamentoPendente(sols.length);
                    waSend(waNumbers, waText, `Faturamentos Pendentes: ${sols.length}`).catch(e =>
                        console.error('❌ [Agendador] Erro WhatsApp faturamento:', e.message)
                    );
                }
            }
        }"""

if bad_block in content:
    content = content.replace(bad_block, good_block)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed faturamentoEmailJob.js")
else:
    print("Could not find the bad block!")
