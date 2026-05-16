const cron = require('node-cron');
const db = require('../db');
const mysql = require('./mysqlService');
const nodemailer = require('nodemailer');
const { sendText } = require('./whatsapp'); // evolution api wrapper

// Map to prevent multiple runs in the same minute just in case
let lastRunStamp = '';

async function startFaturamentoCron() {
    console.log('[CRON] Iniciando agendador de Relatório Diário de Faturamento...');
    
    // Roda a cada minuto
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const currentHourMin = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const currentDay = now.getDay(); // 0: Dom, 1: Seg, ..., 6: Sab
            
            // Impede rodar duas vezes no mesmo minuto
            if (lastRunStamp === currentHourMin) return;

            // Busca as configs no BD
            const [rows] = await mysql.query('SELECT general_config FROM app_company_settings WHERE id = 1');
            if (!rows || rows.length === 0) return;

            let config = rows[0].general_config;
            if (typeof config === 'string') config = JSON.parse(config);

            const autoConfig = config?.faturamento_automation;
            if (!autoConfig || !autoConfig.times || !autoConfig.days || !autoConfig.users || autoConfig.users.length === 0) return;

            // Checa dia da semana e horário
            if (!autoConfig.days.includes(currentDay)) return;
            if (!autoConfig.times.includes(currentHourMin)) return;

            // Marca que rodou nesse minuto
            lastRunStamp = currentHourMin;
            console.log(`[FATURAMENTO] Iniciando geração do relatório automático para as ${currentHourMin}`);
            await processDailyReport(autoConfig.users);
            
            console.log(`[COMPRAS] Iniciando geração do relatório automático de compras para as ${currentHourMin}`);
            await processComprasReport(autoConfig.users);

        } catch (err) {
            console.error('[CRON FATURAMENTO] Erro ao verificar rotina:', err.message);
        }
    });
}

async function processDailyReport(users) {
    try {
        // Formata Data Atual para o formato do Protheus (YYYYMMDD) e visual (DD/MM/YYYY)
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateProtheus = `${yyyy}${mm}${dd}`;
        const dateBr = `${dd}/${mm}/${yyyy}`;

        // Busca NFs faturadas hoje (Exemplo na SF2010 ou SD2010)
        // Considerando que a SF2 guarda o cabeçalho das NFs de saída
        const pgQuery = `
            SELECT 
                SF2.F2_DOC as nota,
                SF2.F2_SERIE as serie,
                SF2.F2_TIPO as tipo,
                SA1.A1_NOME as cliente_nome,
                SF2.F2_VALBRUT as valor_total,
                SF2.F2_VALMERC as valor_mercadoria
            FROM SF2010 SF2
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA AND COALESCE(SA1.D_E_L_E_T_,' ') = ' '
            WHERE SF2.F2_EMISSAO = $1 AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
        `;
        const pgRes = await db.query(pgQuery, [dateProtheus]);
        const nfs = pgRes.rows;

        const mapTipo = (tipo) => {
            const t = (tipo || '').trim().toUpperCase();
            if (t === 'N') return 'Faturamento';
            if (t === 'C') return 'Complemento';
            if (t === 'P') return 'Devolução';
            if (t === 'I') return 'Importação';
            if (t === 'B') return 'Beneficiamento';
            if (t === 'D') return 'Remessa';
            return t || 'Faturamento';
        };

        const totalFaturado = nfs.reduce((acc, nf) => acc + parseFloat(nf.valor_total || 0), 0);
        const qtdNFs = nfs.length;


        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // Group by Client
        const resumoClientes = {};
        nfs.forEach(n => {
            const cliNome = (n.cliente_nome || 'CLIENTE NÃO IDENTIFICADO').trim();
            if (!resumoClientes[cliNome]) resumoClientes[cliNome] = 0;
            resumoClientes[cliNome] += parseFloat(n.valor_total || 0);
        });

        // Group by Type
        const resumoTipos = {};
        nfs.forEach(n => {
            const tipoNome = mapTipo(n.tipo);
            if (!resumoTipos[tipoNome]) resumoTipos[tipoNome] = 0;
            resumoTipos[tipoNome] += parseFloat(n.valor_total || 0);
        });

        let detalhesHTML = '';
        let resumoHTML = '';
        let resumoTipoHTML = '';
        let detalhesWA = '';

        if (qtdNFs === 0) {
            detalhesHTML = '<p>Nenhum item faturado até o momento no dia de hoje.</p>';
            detalhesWA = 'Nenhuma nota fiscal emitida hoje.';
        } else {
            detalhesHTML = `
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                            <th style="padding: 8px; border: 1px solid #e2e8f0;">NF/Série</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0;">Tipo</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0;">Cliente</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${nfs.map(n => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${n.nota?.trim()}/${n.serie?.trim()}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0; font-size: 12px;">${mapTipo(n.tipo)}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0;">${(n.cliente_nome||'').trim()}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight:bold;">${formatBRL(n.valor_total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            resumoHTML = `
                <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px;">Resumo por Cliente</h3>
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <tbody>
                        ${Object.keys(resumoClientes).sort((a,b) => resumoClientes[b] - resumoClientes[a]).map(cli => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${cli}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight:bold; color: #0f172a;">${formatBRL(resumoClientes[cli])}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            resumoTipoHTML = `
                <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px;">Totais por Tipo de Nota</h3>
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <tbody>
                        ${Object.keys(resumoTipos).sort((a,b) => resumoTipos[b] - resumoTipos[a]).map(t => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${t}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight:bold; color: #0f172a;">${formatBRL(resumoTipos[t])}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // WhatsApp conciso
            detalhesWA += `_Totais por Tipo:_\n`;
            Object.keys(resumoTipos).sort((a,b) => resumoTipos[b] - resumoTipos[a]).forEach(t => {
                detalhesWA += `▪️ *${t}*: ${formatBRL(resumoTipos[t])}\n`;
            });

            detalhesWA += `\n_Resumo por Cliente:_\n`;
            Object.keys(resumoClientes).sort((a,b) => resumoClientes[b] - resumoClientes[a]).forEach(cli => {
                detalhesWA += `▪️ *${cli}*: ${formatBRL(resumoClientes[cli])}\n`;
            });
        }

        // WhatsApp Message
        const waMsg = `*📊 RELATÓRIO DIÁRIO DE FATURAMENTO*\n📅 *Data:* ${dateBr}\n\n📦 *Total Geral de NFs:* ${qtdNFs}\n\n${detalhesWA}\n_Mensagem gerencial gerada pelo MetalFisa ERP_`;

        // Busca dados de cada usuario para disparo
        const userIds = users.map(u => u.id);
        const [uRows] = await mysql.query(`SELECT idUsuario, email, telefone, NomeCompleto FROM usuario WHERE idUsuario IN (?)`, [userIds]);

        // Configuração de Email
        let transporter;
        try {
            transporter = nodemailer.createTransport({
                host: 'smtp.task.com.br',
                port: 587,
                secure: false,
                auth: {
                    user: 'sincometal@metalfisa.com.br',
                    pass: 'Pro1042@sm'
                },
                tls: { rejectUnauthorized: false }
            });
        } catch(e) {
            console.error('[CRON FATURAMENTO] Erro ao configurar nodemailer', e);
        }

        // Disparo
        for (const userConfig of users) {
            const dbUser = uRows.find(u => u.idUsuario === userConfig.id);
            if (!dbUser) continue;

            // WhatsApp
            if (userConfig.whatsapp && dbUser.telefone) {
                let tel = dbUser.telefone.replace(/\D/g, '');
                if (tel.length === 11 || tel.length === 10) tel = '55' + tel;
                try {
                    await sendText(`${tel}@s.whatsapp.net`, waMsg);
                    console.log(`[FATURAMENTO] Relatório WA enviado para ${dbUser.NomeCompleto}`);
                } catch(e) {
                    console.error(`[FATURAMENTO] Erro WA para ${dbUser.NomeCompleto}`, e.message);
                }
            }

            // Email
            if (userConfig.email && dbUser.email && transporter) {
                try {
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #2563eb; color: #fff; padding: 20px; text-align: center;">
                                <h2 style="margin: 0;">Relatório Diário de Faturamento</h2>
                                <p style="margin: 5px 0 0 0;">${dateBr}</p>
                            </div>
                            <div style="padding: 20px;">
                                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                                    <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
                                        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Total Geral de NFs</div>
                                        <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${qtdNFs}</div>
                                    </div>
                                </div>
                                <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Detalhamento das NFs</h3>
                                ${detalhesHTML}
                                ${resumoTipoHTML}
                                ${resumoHTML}
                            </div>
                            <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                                <p>Este é um e-mail automático gerado pelo MetalFisa ERP. Por favor, não responda.</p>
                            </div>
                        </div>
                    `;

                    await transporter.sendMail({
                        from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                        to: dbUser.email,
                        subject: `📊 Relatório Diário de Faturamento - ${dateBr}`,
                        html: htmlContent
                    });
                    console.log(`[FATURAMENTO] Relatório E-mail enviado para ${dbUser.NomeCompleto}`);
                } catch(e) {
                    console.error(`[FATURAMENTO] Erro E-mail para ${dbUser.NomeCompleto}`, e.message);
                }
            }
        }
    } catch(err) {
        console.error('[CRON FATURAMENTO] Erro ao processar relatório:', err);
    }
}

async function processComprasReport(users) {
    try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateProtheus = `${yyyy}${mm}${dd}`;
        const dateBr = `${dd}/${mm}/${yyyy}`;

        const pgQuery = `
            SELECT 
                SC7.C7_FORNECE as fornecedor_cod,
                SA2.A2_NOME as fornecedor_nome,
                SC7.C7_NUM as pedido,
                SUM(SC7.C7_TOTAL) as total_pedido
            FROM SC7010 SC7
            LEFT JOIN SA2010 SA2 ON SA2.A2_COD = SC7.C7_FORNECE AND SA2.A2_LOJA = SC7.C7_LOJA AND COALESCE(SA2.D_E_L_E_T_,' ') = ' '
            WHERE SC7.C7_EMISSAO = $1 
              AND COALESCE(SC7.D_E_L_E_T_,' ') = ' '
            GROUP BY 
                SC7.C7_FORNECE,
                SA2.A2_NOME,
                SC7.C7_NUM
            ORDER BY 
                SA2.A2_NOME, SC7.C7_NUM
        `;
        const pgRes = await db.query(pgQuery, [dateProtheus]);
        const pedidos = pgRes.rows;

        const totalComprado = pedidos.reduce((acc, p) => acc + parseFloat(p.total_pedido || 0), 0);
        const qtdPedidos = pedidos.length;

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        let detalhesHTML = '';
        let detalhesWA = '';

        if (qtdPedidos === 0) {
            detalhesHTML = '<p>Nenhum pedido de compra emitido no dia de hoje.</p>';
            detalhesWA = 'Nenhum pedido de compra emitido hoje.';
        } else {
            detalhesHTML = `
                <table style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; text-align: left;">
                            <th style="padding: 8px; border: 1px solid #e2e8f0;">Pedido</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0;">Fornecedor</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedidos.map(p => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${p.pedido?.trim()}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0;">${(p.fornecedor_nome||'FORNECEDOR NÃO IDENTIFICADO').trim()}</td>
                                <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight:bold;">${formatBRL(p.total_pedido)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            detalhesWA += `_Resumo por Fornecedor:_\n`;
            pedidos.forEach(p => {
                const forn = (p.fornecedor_nome||'').trim();
                detalhesWA += `▪️ *${forn}*: ${formatBRL(p.total_pedido)}\n`;
            });
        }

        const waMsg = `*🛒 RELATÓRIO DIÁRIO DE COMPRAS*\n📅 *Data:* ${dateBr}\n\n📦 *Total de Pedidos:* ${qtdPedidos}\n💰 *Valor Comprometido:* ${formatBRL(totalComprado)}\n\n${detalhesWA}\n_Mensagem gerencial gerada pelo MetalFisa ERP_`;

        // Busca dados de cada usuario para disparo
        const userIds = users.map(u => u.id);
        const [uRows] = await mysql.query(`SELECT idUsuario, email, telefone, NomeCompleto FROM usuario WHERE idUsuario IN (?)`, [userIds]);

        let transporter;
        try {
            transporter = nodemailer.createTransport({
                host: 'smtp.task.com.br',
                port: 587,
                secure: false,
                auth: {
                    user: 'sincometal@metalfisa.com.br',
                    pass: 'Pro1042@sm'
                },
                tls: { rejectUnauthorized: false }
            });
        } catch(e) {
            console.error('[CRON COMPRAS] Erro ao configurar nodemailer', e);
        }

        // Disparo
        for (const userConfig of users) {
            const dbUser = uRows.find(u => u.idUsuario === userConfig.id);
            if (!dbUser) continue;

            // WhatsApp
            if (userConfig.whatsapp && dbUser.telefone) {
                let tel = dbUser.telefone.replace(/\\D/g, '');
                if (tel.length === 11 || tel.length === 10) tel = '55' + tel;
                try {
                    await sendText(`${tel}@s.whatsapp.net`, waMsg);
                    console.log(`[COMPRAS] Relatório WA enviado para ${dbUser.NomeCompleto}`);
                } catch(e) {
                    console.error(`[COMPRAS] Erro WA para ${dbUser.NomeCompleto}`, e.message);
                }
            }

            // Email
            if (userConfig.email && dbUser.email && transporter) {
                try {
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #f59e0b; color: #fff; padding: 20px; text-align: center;">
                                <h2 style="margin: 0;">Relatório Diário de Compras</h2>
                                <p style="margin: 5px 0 0 0;">${dateBr}</p>
                            </div>
                            <div style="padding: 20px;">
                                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                                    <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center;">
                                        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Total de Pedidos</div>
                                        <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${qtdPedidos}</div>
                                    </div>
                                    <div style="flex: 1; background: #fffbeb; padding: 15px; border-radius: 8px; text-align: center;">
                                        <div style="font-size: 12px; color: #b45309; text-transform: uppercase; font-weight: bold;">Valor Comprometido</div>
                                        <div style="font-size: 24px; font-weight: bold; color: #d97706;">${formatBRL(totalComprado)}</div>
                                    </div>
                                </div>
                                <h3 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">Detalhamento das Compras</h3>
                                ${detalhesHTML}
                            </div>
                            <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                                <p>Este é um e-mail automático gerado pelo MetalFisa ERP. Por favor, não responda.</p>
                            </div>
                        </div>
                    `;

                    await transporter.sendMail({
                        from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                        to: dbUser.email,
                        subject: `🛒 Relatório Diário de Compras - ${dateBr}`,
                        html: htmlContent
                    });
                    console.log(`[COMPRAS] Relatório E-mail enviado para ${dbUser.NomeCompleto}`);
                } catch(e) {
                    console.error(`[COMPRAS] Erro E-mail para ${dbUser.NomeCompleto}`, e.message);
                }
            }
        }
    } catch(err) {
        console.error('[CRON COMPRAS] Erro ao processar relatório:', err);
    }
}

module.exports = { startFaturamentoCron, processDailyReport, processComprasReport };
