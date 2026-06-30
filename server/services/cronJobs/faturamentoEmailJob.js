const cron = require('node-cron');
const nodemailer = require('nodemailer');
const mysqlPool = require('../mysqlService');
const { sendText: waSend, logEmailSent, msgFaturamentoPendente } = require('../whatsapp');

let getCorpEmailType = (html) => html;
try {
    const utils = require('../../utils/emailTemplate');
    if (utils && utils.getCorporateEmailTemplate) getCorpEmailType = utils.getCorporateEmailTemplate;
} catch (e) { console.warn("Could not load email template wrapper."); }

const runJob = async (isTest = false, testEmail = null) => {
    try {
        console.log(`[Agendador] Iniciando rotina de envio de faturamentos pendentes...`);
        
        // Obter solicitações PENDENTES
        const [sols] = await mysqlPool.query(`SELECT * FROM app_faturamento_solicitacoes WHERE status = 'Pendente' ORDER BY created_at DESC`);
        
        if (!sols || sols.length === 0) {
            console.log(`[Agendador] Sem pendências hoje. E-mail não enviado.`);
            return;
        }

        const solIds = sols.map(s => s.id);
        const placeholders = solIds.map(() => '?').join(',');
        
        const [items] = await mysqlPool.query(`SELECT * FROM app_faturamento_solicitacao_itens WHERE solicitacao_id IN (${placeholders})`, solIds);

        let conteudosHtml = '';
        for (const sol of sols) {
            const solItems = items.filter(it => it.solicitacao_id === sol.id);
            let itemsHtml = solItems.map(it => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px;">${it.pedido}-${it.item}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px; font-weight: bold; color: #334155;">${it.nome_cliente || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px;">${it.codigo_produto}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px; text-align: right;">${it.quantidade_solicitada}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px;">${it.pedido_cliente || '-'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-size: 13px; font-weight: bold; color: #1e40af;">${it.desenho_cliente || '-'}</td>
                </tr>
            `).join('');

            conteudosHtml += `
                <div style="margin-bottom: 30px; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; background-color: #fafbfc;">
                    <h3 style="color: #0f172a; margin-top: 0; margin-bottom: 5px;">Solicitação em Aberto: <span style="color:#1e40af">${sol.numero_solicitacao}</span></h3>
                    <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Solicitante:</strong> ${sol.usuario}</p>
                    <p style="margin: 0 0 15px 0; font-size: 13px; color: #475569;"><strong>Na fila desde:</strong> ${new Date(sol.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background-color: #f1f5f9; text-align: left;">
                            <tr>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Pedido/Item</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Cliente</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Cód. Produto</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; text-align: right;">Qtd P/ Exp.</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Ped. Cliente</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;">Desenho Cli.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Descobrir DESTINATARIOS a partir de app_company_settings (igual no route.js de faturamento)
        let recipientList = [];
        const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        if (configRows.length && configRows[0].general_config) {
            const configObj = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
            const emailsConfig = configObj.faturamento_emails;

            if (emailsConfig && Array.isArray(emailsConfig) && emailsConfig.length > 0) {
                const [userRows] = await mysqlPool.query(
                    `SELECT email, whatsapp FROM usuario WHERE idUsuario IN (?) AND (email IS NOT NULL OR whatsapp IS NOT NULL)`,
                    [emailsConfig]
                );
                recipientList = userRows.map(u => u.email).filter(Boolean);

                // WhatsApp
                const waNumbers = userRows.map(u => u.whatsapp).filter(Boolean);
                if (waNumbers.length > 0) {
                    const waText = msgFaturamentoPendente(sols.length);
                    waSend(waNumbers, waText, `Faturamentos Pendentes: ${sols.length}`).catch(e =>
                        console.error('❌ [Agendador] Erro WhatsApp faturamento:', e.message)
                    );
                }
            }
        }

        // Adiciona e-mail de teste se for manual
        if (isTest && testEmail) {
            recipientList.push(testEmail);
        }

        // Limpa duplicatas
        recipientList = [...new Set(recipientList)];

        if (recipientList.length === 0) {
            console.log(`[Agendador] Ninguém configurado para receber o alerta de Faturamentos. E-mail cancelado.`);
            return;
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.task.com.br',
            port: 587,
            secure: false,
            auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
            tls: { rejectUnauthorized: false }
        });

        const htmlBody = `
            <h2 style="color: #dc2626;">🚨 Atenção! Faturamentos Diários em Aberto</h2>
            <p style="font-size: 15px;">Este é um resumo gerencial informando que temos <strong>${sols.length}</strong> lote(s) de expedição aguardando emissão e vínculo da Nota Fiscal no sistema.</p>
            <br/>
            ${conteudosHtml}
            <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Este é um alerta automático gerado pelo ERP MetalFisa SINCO (Agendador Noturno). Por favor, trate as solicitações no "Controle de Faturamento".</p>
        `;

        const subject = `🚨 [Visão Gerencial] Temos ${sols.length} Solicitações de Faturamento Pendentes`;
        await transporter.sendMail({
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to: recipientList.join(','),
            subject,
            html: getCorpEmailType(htmlBody)
        });
        logEmailSent({ recipients: recipientList, subject, body: htmlBody }).catch(() => {});
        console.log(`✅ [Agendador] E-mail gerencial disparado com sucesso para: ${recipientList.join(',')}`);

    } catch (e) {
        console.error(`❌ [Agendador] Falha na rotina de faturamento diário:`, e);
    }
};

const init = () => {
    // Roda todos os dias às 18:01
    cron.schedule('1 18 * * *', () => {
        const { isWeekendOrHoliday } = require('../../utils/dateHelper');
        if (isWeekendOrHoliday()) {
            console.log('[Agendador] Hoje é final de semana ou feriado. Notificação de faturamentos pendentes pulada.');
            return;
        }
        runJob(false);
    });
    console.log('⏳ [Agendador] Rotina de Faturamento Pendente registrada para as 18:01 diariamente.');
};

module.exports = { init, runJob };
