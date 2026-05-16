const fs = require('fs');
let code = fs.readFileSync('setores.js', 'utf8');

// Remove the previous POST /visao/notify we appended if it exists
code = code.replace(/router\.post\('\/visao\/notify'[\s\S]*?(?=module\.exports = router;)/, '');

const newEndpoint = `
const { sendText } = require('../services/whatsapp');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');
const nodemailer = require('nodemailer');
const axios = require('axios');

const transporter = nodemailer.createTransport({
    host: 'smtp.task.com.br',
    port: 587,
    secure: false,
    auth: {
        user: 'sincometal@metalfisa.com.br',
        pass: 'Pro1042@sm'
    },
    tls: { rejectUnauthorized: false }
});

router.post('/visao/notify', async (req, res) => {
    try {
        const { filters, tipo, canal } = req.body; // tipo: 'responsibles', 'all', 'me', canal: 'whatsapp' or 'email'
        
        // 1. Fetch visao data (using local request)
        const port = process.env.PORT || 3002;
        const url = \`http://127.0.0.1:\${port}/api/pcp-setores/visao\`;
        
        const visaoRes = await axios.get(url, { params: filters });
        const visaoData = visaoRes.data;

        // 2. Load all responsibles
        const [respRows] = await mysql.query(\`
            SELECT r.setor_id, u.idUsuario, u.NomeCompleto, u.email, u.telefone 
            FROM pcp_setor_responsaveis r
            JOIN usuario u ON u.idUsuario = r.usuario_id
        \`);
        
        let sentLog = [];
        
        // Formatter for WhatsApp
        const formatWhatsapp = (nome, setores) => {
            const linhas = setores.map(s => {
                const kpis = s.kpis || {};
                const progresso = kpis.progresso_medio || 0;
                const emoji = progresso >= 90 ? '✅' : progresso >= 60 ? '⚠️' : '❌';
                return \`• *\${s.nome}*: \${progresso}% concluído (\${kpis.concluidas || 0}/\${kpis.total || 0} OPs) \${emoji}\`;
            }).join('\\n');
            return \`📊 *Evolução de Pedidos por Setor*\\nOlá, \${nome}!\\n\\n\${linhas}\`;
        };

        // Formatter for E-mail (HTML)
        const formatEmailHtml = (nome, setores) => {
            let trs = setores.map(s => {
                const kpis = s.kpis || {};
                const progresso = kpis.progresso_medio || 0;
                const cor = progresso >= 90 ? '#10b981' : progresso >= 60 ? '#f59e0b' : '#ef4444';
                return \`
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>\${s.nome}</strong></td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;"><span style="color: \${cor}; font-weight: bold;">\${progresso}%</span></td>
                    <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">\${kpis.concluidas || 0} / \${kpis.total || 0} OPs</td>
                </tr>
                \`;
            }).join('');

            return \`
                <div style="font-family: sans-serif; color: #334155;">
                    <h2 style="color: #0f172a;">📊 Evolução de Pedidos por Setor</h2>
                    <p>Olá, <strong>\${nome}</strong>!</p>
                    <p>Segue o resumo da produção e andamento de seus setores:</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead style="background-color: #f8fafc;">
                            <tr>
                                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1;">Setor</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #cbd5e1;">Progresso</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #cbd5e1;">OPs</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${trs}
                        </tbody>
                    </table>
                    <p style="margin-top: 30px; font-size: 12px; color: #64748b;">Relatório gerado automaticamente pelo sistema SGQ MetalFisa.</p>
                </div>
            \`;
        };

        // Grouping data by user
        let userSetores = {};
        if (tipo === 'responsibles') {
            for (const r of respRows) {
                if (!userSetores[r.idUsuario]) {
                    userSetores[r.idUsuario] = { user: r, setores: [] };
                }
                const sData = visaoData.find(v => v.id === r.setor_id);
                if (sData) userSetores[r.idUsuario].setores.push(sData);
            }
        } else if (tipo === 'all') {
            const uniqueUsers = {};
            respRows.forEach(r => uniqueUsers[r.idUsuario] = r);
            for (const user of Object.values(uniqueUsers)) {
                userSetores[user.idUsuario] = { user, setores: visaoData };
            }
        } else if (tipo === 'me') {
            const { telefone, email, nome } = req.body;
            userSetores['me'] = {
                user: { NomeCompleto: nome || 'Usuário', telefone: telefone, email: email },
                setores: visaoData
            };
        }

        // Sending Loop
        for (const [userId, data] of Object.entries(userSetores)) {
            if (data.setores.length > 0) {
                try {
                    if (canal === 'email' && data.user.email) {
                        const html = getCorporateEmailTemplate(formatEmailHtml(data.user.NomeCompleto, data.setores));
                        const info = await transporter.sendMail({
                            from: '"MetalFisa PCP" <sincometal@metalfisa.com.br>',
                            to: data.user.email,
                            subject: \`Relatório PCP: Evolução de Pedidos - \${data.user.NomeCompleto}\`,
                            html: html
                        });
                        sentLog.push({ target: data.user.NomeCompleto, canal: 'email', ok: true });
                    } 
                    else if (canal !== 'email' && data.user.telefone) { // default whatsapp
                        const texto = formatWhatsapp(data.user.NomeCompleto, data.setores);
                        const resultado = await sendText(data.user.telefone, texto, 'Visão Setores - ' + data.user.NomeCompleto);
                        sentLog.push({ target: data.user.NomeCompleto, canal: 'whatsapp', ok: resultado.some(x => x.ok) });
                    }
                } catch (sendErr) {
                    console.error(\`Falha ao enviar \${canal} para \${data.user.NomeCompleto}:\`, sendErr.message);
                    sentLog.push({ target: data.user.NomeCompleto, canal: canal, ok: false, error: sendErr.message });
                }
            }
        }

        res.json({ success: true, message: 'Relatórios processados!', sentLog });
    } catch (err) {
        console.error('[setores/visao/notify] Erro:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});
`;

code = code.replace(/module\.exports = router;/, newEndpoint + '\nmodule.exports = router;');
fs.writeFileSync('setores.js', code);
console.log('Patch 2 aplicado com sucesso.');
