const cron = require('node-cron');
const nodemailer = require('nodemailer');
const mysqlPool = require('../mysqlService');
const { sendMail } = require('../mailService');
const { sendText: waSend } = require('../whatsapp');

let getCorpEmailType = (html) => html;
try {
    const utils = require('../../utils/emailTemplate');
    if (utils && utils.getCorporateEmailTemplate) getCorpEmailType = utils.getCorporateEmailTemplate;
} catch (e) { console.warn("Could not load email template wrapper."); }

const runJob = async (isTest = false, testEmail = null, testWa = null) => {
    try {
        console.log(`[Agendador SGQ] Iniciando rotina de verificação de alertas de calibração...`);

        // Obter configurações globais
        const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        if (!configRows.length || !configRows[0].general_config) {
            console.log(`[Agendador SGQ] Configurações globais não encontradas.`);
            return;
        }

        const configObj = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
        
        // Verifica se o módulo SGQ está ativo
        if (!configObj.module_sgq_active) {
            console.log(`[Agendador SGQ] Módulo SGQ desativado. Cancelando job.`);
            return;
        }

        if (configObj.automations?.sgq_alerts_active === false && configObj.automations?.sgq_alerts_email_active === false) {
            console.log(`[Agendador SGQ] Alertas SGQ desativados nas configurações globais (WhatsApp e E-mail). Cancelando job.`);
            return;
        }

        const sgqAlertUsers = configObj.sgq_alerts_users || [];
        if (sgqAlertUsers.length === 0) {
            console.log(`[Agendador SGQ] Nenhum usuário configurado para receber alertas do SGQ.`);
            return;
        }

        const templateWhatsApp = configObj.sgq_alerts_template_whatsapp || '⚠️ *Alerta SGQ - Calibração* ⚠️\nO instrumento {name} (Patrimônio: {patrimonio}) vencerá em {validade} ({dias} dias).';
        const templateEmail = configObj.sgq_alerts_template_email || 'Prezado(a),\n\nInformamos que o instrumento {name} (Patrimônio: {patrimonio}) possui calibração válida apenas até {validade} ({dias} dias restantes).\n\nPor favor, providencie a calibração.';

        // Obter ativos que requerem calibração e possuem data de validade definida
        const [ativos] = await mysqlPool.query(`SELECT id, name, patrimonio, calibration_validity FROM sgq_assets WHERE requires_calibration = TRUE AND calibration_validity IS NOT NULL`);
        
        if (!ativos || ativos.length === 0) {
            console.log(`[Agendador SGQ] Nenhum ativo requer calibração no momento.`);
            return;
        }

        // Buscar configurações de alerta específicas para cruzar os dados
        const [alertasConfig] = await mysqlPool.query(`SELECT asset_id, days_before, notify_email, notify_whatsapp, target_users FROM sgq_asset_alerts`);

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let mensagensDisparadas = 0;

        // Recuperar contatos dos usuários do sistema
        const [sysUsers] = await mysqlPool.query(`SELECT idUsuario, telefone, email, nome FROM app_usuarios WHERE aprovado = 1`);

        for (const ativo of ativos) {
            const validade = new Date(ativo.calibration_validity);
            validade.setHours(0, 0, 0, 0);

            const diffTime = validade.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Filtra se hoje bate com algum "days_before" configurado para este ativo
            const regrasAplicaveis = alertasConfig.filter(a => a.asset_id === ativo.id && a.days_before === diffDays);

            if (regrasAplicaveis.length > 0) {
                // Monta as mensagens
                const formattedDate = validade.toLocaleDateString('pt-BR');
                const msgWa = templateWhatsApp
                    .replace(/{name}/g, ativo.name || '')
                    .replace(/{patrimonio}/g, ativo.patrimonio || '')
                    .replace(/{validade}/g, formattedDate)
                    .replace(/{dias}/g, diffDays.toString());

                const msgEmailTxt = templateEmail
                    .replace(/{name}/g, ativo.name || '')
                    .replace(/{patrimonio}/g, ativo.patrimonio || '')
                    .replace(/{validade}/g, formattedDate)
                    .replace(/{dias}/g, diffDays.toString());
                
                const htmlBody = `
                    <h2 style="color: #dc2626;">⚠️ Alerta SGQ: Calibração à Vencer</h2>
                    <p style="font-size: 15px; white-space: pre-line;">${msgEmailTxt}</p>
                `;
                const finalHtml = getCorpEmailType(htmlBody);

                // Enviar para os usuários do grupo
                for (const uPref of sgqAlertUsers) {
                    const sysUser = sysUsers.find(u => u.idUsuario === uPref.id);
                    if (!sysUser) continue;

                    // Envio WhatsApp
                    if (configObj.automations?.sgq_alerts_active !== false && uPref.whatsapp && sysUser.telefone && regrasAplicaveis.some(r => r.notify_whatsapp)) {
                        const tel = isTest ? testWa : sysUser.telefone;
                        if (tel) {
                            try {
                                await waSend(tel, msgWa);
                                console.log(`[Agendador SGQ] WhatsApp enviado para ${sysUser.nome} (${tel}) sobre o ativo ${ativo.name}.`);
                                mensagensDisparadas++;
                            } catch (err) {
                                console.error(`[Agendador SGQ] Falha ao enviar WhatsApp para ${sysUser.nome}:`, err.message);
                            }
                        }
                    }

                    // Envio E-mail
                    if (configObj.automations?.sgq_alerts_email_active !== false && uPref.email && sysUser.email && regrasAplicaveis.some(r => r.notify_email)) {
                        const em = isTest ? testEmail : sysUser.email;
                        if (em) {
                            try {
                                await sendMail({
                                    to: em,
                                    subject: `Alerta SGQ - Calibração: ${ativo.name}`,
                                    html: finalHtml
                                });
                                console.log(`[Agendador SGQ] E-mail enviado para ${sysUser.nome} (${em}) sobre o ativo ${ativo.name}.`);
                                mensagensDisparadas++;
                            } catch (err) {
                                console.error(`[Agendador SGQ] Falha ao enviar e-mail para ${sysUser.nome}:`, err.message);
                            }
                        }
                    }
                }
            }
        }

        console.log(`[Agendador SGQ] Rotina concluída. ${mensagensDisparadas} notificação(ões) disparada(s).`);

    } catch (err) {
        console.error(`[Agendador SGQ] ERRO GERAL:`, err);
    }
};

const init = () => {
    // Roda todos os dias às 08:30 da manhã
    cron.schedule('30 8 * * *', async () => {
        await runJob();
    });
    console.log('[Agendador] SGQ Alerts Cron Job registrado para 08:30 (Diário).');
};

module.exports = { init, runJob };
