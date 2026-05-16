const fs = require('fs');
let code = fs.readFileSync('setores.js', 'utf8');

const newEndpoint = `
const { sendText } = require('../services/whatsapp');
const axios = require('axios');

router.post('/visao/notify', async (req, res) => {
    try {
        const { filters, tipo } = req.body; // tipo: 'responsibles', 'all', 'me'
        
        // 1. Fetch visao data (using local request)
        const host = req.headers.host || 'localhost:3002';
        const protocol = req.protocol || 'http';
        const url = \`\${protocol}://\${host}/api/pcp-setores/visao\`;
        
        const visaoRes = await axios.get(url, { params: filters });
        const visaoData = visaoRes.data;

        // 2. Load all responsibles
        const [respRows] = await mysql.query(\`
            SELECT r.setor_id, u.idUsuario, u.NomeCompleto, u.email, u.telefone 
            FROM pcp_setor_responsaveis r
            JOIN usuario u ON u.idUsuario = r.usuario_id
        \`);
        
        let sentLog = [];
        
        // Helper to format WhatsApp message
        const formatWhatsapp = (nome, setores) => {
            const linhas = setores.map(s => {
                const kpis = s.kpis || {};
                const progresso = kpis.progresso_medio || 0;
                const emoji = progresso >= 90 ? '✅' : progresso >= 60 ? '⚠️' : '❌';
                return \`• *\${s.nome}*: \${progresso}% concluído (\${kpis.concluidas || 0}/\${kpis.total || 0} OPs) \${emoji}\`;
            }).join('\\n');
            return \`📊 *Evolução de Pedidos por Setor*\\nOlá, \${nome}!\\n\\n\${linhas}\`;
        };

        if (tipo === 'responsibles') {
            const userSetores = {};
            for (const r of respRows) {
                if (!userSetores[r.idUsuario]) {
                    userSetores[r.idUsuario] = { user: r, setores: [] };
                }
                const sData = visaoData.find(v => v.id === r.setor_id);
                if (sData) userSetores[r.idUsuario].setores.push(sData);
            }
            
            for (const [userId, data] of Object.entries(userSetores)) {
                if (data.setores.length > 0 && data.user.telefone) {
                    const texto = formatWhatsapp(data.user.NomeCompleto, data.setores);
                    const resultado = await sendText(data.user.telefone, texto, 'Visão Setores - ' + data.user.NomeCompleto);
                    sentLog.push({ target: data.user.NomeCompleto, ok: resultado.some(x => x.ok) });
                }
            }
        } 
        else if (tipo === 'all') {
            const uniqueUsers = {};
            respRows.forEach(r => uniqueUsers[r.idUsuario] = r);
            
            for (const user of Object.values(uniqueUsers)) {
                if (user.telefone) {
                    const texto = formatWhatsapp(user.NomeCompleto, visaoData);
                    const resultado = await sendText(user.telefone, texto, 'Visão Setores Geral - ' + user.NomeCompleto);
                    sentLog.push({ target: user.NomeCompleto, ok: resultado.some(x => x.ok) });
                }
            }
        }
        else if (tipo === 'me') {
            // we expect the frontend to pass the user's phone in req.user, but req.user requires authenticateToken.
            // Let's assume frontend passes a 'telefone' and 'nome' in req.body for this option.
            const { telefone, nome } = req.body;
            if (telefone) {
                const texto = formatWhatsapp(nome || 'Usuário', visaoData);
                const resultado = await sendText(telefone, texto, 'Visão Setores (Eu) - ' + (nome || ''));
                sentLog.push({ target: nome || telefone, ok: resultado.some(x => x.ok) });
            }
        }

        res.json({ success: true, message: 'Relatórios enviados com sucesso!', sentLog });
    } catch (err) {
        console.error('[setores/visao/notify] Erro:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});
`;

code = code.replace(/module\.exports = router;/, newEndpoint + '\nmodule.exports = router;');
fs.writeFileSync('setores.js', code);
console.log('Patch aplicado com sucesso.');
