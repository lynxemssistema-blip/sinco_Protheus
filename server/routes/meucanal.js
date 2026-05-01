const express = require('express');
const router = express.Router();
const db = require('../db'); // PostgreSQL (Protheus)
const mysql = require('../services/mysqlService');
const { authenticateToken } = require('../routes/auth');
const nodemailer = require('nodemailer');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

// =========================================================================
// MOTOR CENTRAL DE CÁLCULO DE KPI (Pode ser chamado pela Rota ou pelo Cron)
// =========================================================================
async function calcularKPIMeuCanal(userId, userLogin, userName, baseDate = null) {
    const todayD = baseDate ? new Date(baseDate) : new Date();
    const yyyy = todayD.getFullYear();
    const mm = String(todayD.getMonth() + 1).padStart(2, '0');
    const dd = String(todayD.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}${mm}${dd}`; // Protheus Format
    const todaySql = `${yyyy}-${mm}-${dd}`; // MySQL Format

    const result = {
        individual: {
            apontado: 0,
            pontuacao_bonus: 0,
            total_pontos: 0,
            apontamentos: []
        },
        setores: []
    };

    try {
        // ================================================================
        // 1. CÁLCULO INDIVIDUAL DO USUÁRIO
        // ================================================================
        const [indivApontamentos] = await mysql.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, quantidade, data_inicio, data_fim, materiais_utilizados
            FROM app_production_appointments 
            WHERE (usuario = ? OR usuario = ?) AND DATE(data_fim) = ?
        `, [userName, userLogin, todaySql]);

        // Contadores por categoria
        result.individual.categorias = {
            sem_planejamento: 0,    // OP sem data prevista (bônus x2)
            no_prazo: 0,            // Iniciou E finalizou dentro do prazo planejado
            iniciado_ok: 0,         // Iniciou na data correta ou antes
            finalizado_ok: 0,       // Finalizou na data correta ou antes
            fora_data: 0            // Finalizou após a data prevista
        };

        for (const ap of indivApontamentos) {
            let temDataPlanejada = false;
            let dataPlanejadaInicio = null;
            let dataPlanejadaFim = null;
            let qty = Number(ap.quantidade) || 0;

            // 1. Tentar achar planejamento no MySQL (app_production_planning)
            const [planRows] = await mysql.query(`
                SELECT data_planejada_inicio, data_planejada_fim 
                FROM app_production_planning 
                WHERE op_numero=? AND op_item=? AND op_sequencia=? AND operacao_codigo=?
            `, [ap.op_numero, ap.op_item, ap.op_sequencia, ap.operacao_codigo]);

            if (planRows.length > 0 && planRows[0].data_planejada_fim) {
                temDataPlanejada = true;
                dataPlanejadaInicio = planRows[0].data_planejada_inicio ? new Date(planRows[0].data_planejada_inicio) : null;
                dataPlanejadaFim = new Date(planRows[0].data_planejada_fim);
            } else {
                // 2. Tentar achar no Protheus (sc2010)
                const pgRes = await db.query(`
                    SELECT c2_datprf, c2_datini 
                    FROM sc2010 
                    WHERE c2_num=$1 AND c2_item=$2 AND c2_sequen=$3 AND COALESCE(d_e_l_e_t_,' ')=' '
                `, [(ap.op_numero||'').trim(), (ap.op_item||'').trim(), (ap.op_sequencia||'').trim()]);
                
                if (pgRes.rows.length > 0) {
                    const datprf = pgRes.rows[0].c2_datprf?.trim();
                    const datini = pgRes.rows[0].c2_datini?.trim();
                    if (datprf && datprf !== '20000101' && datprf !== '') {
                        temDataPlanejada = true;
                        // Converter AAAAMMDD do Protheus para Date
                        dataPlanejadaFim = new Date(`${datprf.slice(0,4)}-${datprf.slice(4,6)}-${datprf.slice(6,8)}`);
                        if (datini && datini !== '20000101' && datini !== '') {
                            dataPlanejadaInicio = new Date(`${datini.slice(0,4)}-${datini.slice(4,6)}-${datini.slice(6,8)}`);
                        }
                    }
                }
            }

            let pontos = qty;
            let categoria = 'sem_planejamento';

            if (!temDataPlanejada) {
                pontos = qty * 2;
                result.individual.pontuacao_bonus += qty;
                categoria = 'sem_planejamento';
            } else {
                // Comparar datas reais com planejadas
                const dataFimReal = ap.data_fim ? new Date(ap.data_fim) : new Date();
                const dataInicioReal = ap.data_inicio ? new Date(ap.data_inicio) : null;

                const fimOk = dataPlanejadaFim ? dataFimReal <= dataPlanejadaFim : true;
                const inicioOk = (dataPlanejadaInicio && dataInicioReal) ? dataInicioReal <= dataPlanejadaInicio : true;

                if (fimOk && inicioOk) {
                    categoria = 'no_prazo';
                } else if (inicioOk && !fimOk) {
                    categoria = 'iniciado_ok';   // Começou ok, mas não terminou a tempo
                } else if (!inicioOk && fimOk) {
                    categoria = 'finalizado_ok'; // Atrasou o início, mas recuperou e terminou ok
                } else {
                    categoria = 'fora_data';
                }
            }

            result.individual.categorias[categoria]++;
            result.individual.apontado += qty;
            result.individual.total_pontos += pontos;
            result.individual.apontamentos.push({
                ...ap,
                pontos_gerados: pontos,
                tem_data_planejada: temDataPlanejada,
                categoria
            });
        }

        // ================================================================
        // 2. CÁLCULO DOS SETORES ONDE ELE É RESPONSÁVEL
        // ================================================================
        const [setoresResp] = await mysql.query(`
            SELECT sr.setor_id, s.nome as setor_nome
            FROM pcp_setor_responsaveis sr
            JOIN pcp_setores s ON s.id = sr.setor_id
            WHERE sr.usuario_id = ?
        `, [userId]);

        // Buscar apontamentos do dia UMA ÚNICA VEZ (MySQL) para todos os setores, agrupando por usuario
        const [apontRowsGlobal] = await mysql.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, usuario, SUM(quantidade) as total_apontado, COUNT(*) as qtd_acoes
            FROM app_production_appointments
            WHERE DATE(data_fim) = ?
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo, usuario
        `, [todaySql]);

        // ── Fase 1: buscar recursos de cada setor sequencialmente (evita pool exhaustion) ──
        const setoresComRecursos = [];
        for (const setor of setoresResp) {
            const [recursos] = await mysql.query(
                'SELECT recurso_codigo FROM pcp_setor_recursos WHERE setor_id = ?',
                [setor.setor_id]
            );
            setoresComRecursos.push({
                ...setor,
                recursos: recursos.map(r => r.recurso_codigo.trim().toUpperCase())
            });
        }

        // ── Fase 2: UMA ÚNICA query PG para TODOS os recursos de TODOS os setores ──
        const todosRecursos = [...new Set(setoresComRecursos.flatMap(s => s.recursos))];

        let todasOpsPlanejadas = [];
        if (todosRecursos.length > 0) {
            const placeholdersAll = todosRecursos.map((_, i) => `$${i + 1}`).join(',');
            const pgRes = await db.query(`
                SELECT DISTINCT ON (c2.c2_num, c2.c2_item, c2.c2_sequen, g2.g2_operac, g2.g2_recurso)
                    TRIM(c2.c2_num)     AS op_numero,
                    TRIM(c2.c2_item)    AS op_item,
                    TRIM(c2.c2_sequen)  AS op_sequencia,
                    TRIM(c2.c2_produto) AS produto,
                    c2.c2_quant::numeric AS qtd_planejada,
                    TRIM(g2.g2_operac)  AS operacao_codigo,
                    TRIM(g2.g2_descri)  AS operacao_nome,
                    TRIM(g2.g2_recurso) AS recurso
                FROM sc2010 c2
                JOIN sg2010 g2
                    ON btrim(g2.g2_produto) = btrim(c2.c2_produto)
                   AND COALESCE(g2.d_e_l_e_t_, ' ') = ' '
                WHERE btrim(g2.g2_recurso) IN (${placeholdersAll})
                  AND c2.c2_datprf = $${todosRecursos.length + 1}
                  AND COALESCE(c2.d_e_l_e_t_, ' ') = ' '
                ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen, g2.g2_operac, g2.g2_recurso
            `, [...todosRecursos, todayStr]);
            todasOpsPlanejadas = pgRes.rows;
        }

        // ── Fase 3: distribuir resultados por setor em memória (zero queries extras) ──
        const setoresCalculados = setoresComRecursos.map((setor) => {
            if (setor.recursos.length === 0) {
                return {
                    id: setor.setor_id,
                    nome: setor.setor_nome,
                    producaoPlanejada: 0,
                    producaoRealizada: 0,
                    score: 0,
                    nivel: 'Crítico',
                    cor: '#ef4444',
                    pendencias: [],
                    usuarios: []
                };
            }

            const recursosSet = new Set(setor.recursos);
            const opsPlanejadas = todasOpsPlanejadas.filter(
                op => recursosSet.has((op.recurso || '').trim().toUpperCase())
            );

            const totalPlanejadoSetor = opsPlanejadas.reduce(
                (acc, curr) => acc + Number(curr.qtd_planejada), 0
            );

            const planejadosMap = new Map();
            opsPlanejadas.forEach(p => {
                planejadosMap.set(`${p.op_numero}|${p.operacao_codigo}`, Number(p.qtd_planejada));
            });

            let totalApontadoSetor = 0;
            const usuariosMap = new Map();

            for (const ap of apontRowsGlobal) {
                const chave = `${(ap.op_numero||'').trim()}|${(ap.operacao_codigo||'').trim()}`;
                if (planejadosMap.has(chave)) {
                    totalApontadoSetor += Number(ap.total_apontado);
                    
                    const userName = ap.usuario || 'Desconhecido';
                    if (!usuariosMap.has(userName)) {
                        usuariosMap.set(userName, { 
                            nome: userName, 
                            acoes: 0, 
                            produzido: 0, 
                            previsto: 0,
                            ops_tocadas: new Set()
                        });
                    }
                    const uStats = usuariosMap.get(userName);
                    uStats.acoes += Number(ap.qtd_acoes);
                    uStats.produzido += Number(ap.total_apontado);
                    uStats.ops_tocadas.add(chave);
                }
            }

            // Calculate total planned for the operations each user touched
            const usuariosList = Array.from(usuariosMap.values()).map(u => {
                let previstoTotal = 0;
                u.ops_tocadas.forEach(chave => {
                    previstoTotal += planejadosMap.get(chave) || 0;
                });
                return {
                    nome: u.nome,
                    acoes: u.acoes,
                    produzido: u.produzido,
                    previsto: previstoTotal
                };
            }).sort((a, b) => b.produzido - a.produzido);

            let perc = totalPlanejadoSetor > 0 ? (totalApontadoSetor / totalPlanejadoSetor) * 100 : 0;
            if (totalPlanejadoSetor === 0 && totalApontadoSetor > 0) perc = 100;

            let nivel = 'Crítico';
            let cor = '#ef4444';
            if (perc > 25 && perc <= 50) { nivel = 'Atenção'; cor = '#f97316'; }
            else if (perc > 50 && perc <= 75) { nivel = 'Bom'; cor = '#eab308'; }
            else if (perc > 75) { nivel = 'Excelente'; cor = '#22c55e'; }

            const pendencias = opsPlanejadas.reduce((acc, plan) => {
                // Sum all user appointments for this planned operation
                const totalRealizadoPlan = apontRowsGlobal
                    .filter(a => (a.op_numero||'').trim() === plan.op_numero && (a.operacao_codigo||'').trim() === plan.operacao_codigo)
                    .reduce((sum, a) => sum + Number(a.total_apontado), 0);

                if (totalRealizadoPlan < Number(plan.qtd_planejada)) {
                    acc.push({
                        op: plan.op_numero,
                        produto: plan.produto,
                        operacao: plan.operacao_nome,
                        esperado: Number(plan.qtd_planejada),
                        realizado: totalRealizadoPlan
                    });
                }
                return acc;
            }, []);

            return {
                id: setor.setor_id,
                nome: setor.setor_nome,
                producaoPlanejada: totalPlanejadoSetor,
                producaoRealizada: totalApontadoSetor,
                score: Math.round(perc),
                nivel,
                cor,
                pendencias,
                usuarios: usuariosList
            };
        });

        result.setores = setoresCalculados;
        return result;

    } catch (err) {
        console.error('Erro ao calcular KPI Meu Canal:', err);
        throw err;
    }
}

// =========================================================================
// ROTA GET DA TELA (Chamada pelo Frontend)
// =========================================================================
router.get('/kpi', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.idUsuario;
        const userLogin = req.user?.login || req.user?.Login;
        const userName = req.user?.nome || req.user?.NomeCompleto || userLogin;

        // Buscar foto diretamente do banco (não está no payload JWT)
        const [userRows] = await mysql.query(
            'SELECT fotoUsuario FROM usuario WHERE idUsuario = ?',
            [userId]
        );
        const userFoto = userRows[0]?.fotoUsuario || null;

        const data = await calcularKPIMeuCanal(userId, userLogin, userName);

        data.usuario = {
            id: userId,
            nome: userName,
            login: userLogin,
            foto: userFoto
        };

        res.json(data);
    } catch (err) {
        console.error('[MEUCANAL /kpi] ERRO:', err.message);
        console.error('[MEUCANAL /kpi] STACK:', err.stack);
        res.status(500).json({ error: 'Erro interno ao processar Meu Canal', detail: err.message });
    }
});

// =========================================================================
// ROTA GET PARA TESTE DE E-MAIL MANUAL (Chamada via navegador)
// =========================================================================
router.get('/test-email', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.idUsuario;
        const userLogin = req.user?.login || req.user?.Login;
        const userName = req.user?.nome || req.user?.NomeCompleto || userLogin;
        
        // 1. Calcular o KPI para o usuário atual
        const kpiData = await calcularKPIMeuCanal(userId, userLogin, userName);
        
        // 2. Tentar resgatar o e-mail real do usuário do banco MySQL
        const [uRows] = await mysql.query('SELECT email FROM usuario WHERE idUsuario = ?', [userId]);
        const userEmail = uRows[0]?.email;

        if (!userEmail) {
            return res.status(400).json({ error: 'Seu usuário não possui um e-mail cadastrado no sistema.' });
        }

        // 3. Montar e-mail compacto — só totais
        const hoje = new Date().toLocaleDateString('pt-BR');
        const nivelEmoji = { 'Excelente': '🟢', 'Bom': '🟡', 'Atenção': '🟠', 'Crítico': '🔴' };

        let linhasSetores = '';
        for (const s of kpiData.setores) {
            const emoji = nivelEmoji[s.nivel] || '⚫';
            linhasSetores += `
                <tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${emoji} ${s.nome}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${s.producaoPlanejada ?? 0}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${s.producaoRealizada ?? 0}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:bold;color:${s.cor};">${s.score}%</td>
                </tr>`;
        }

        const semSetores = kpiData.setores.length === 0
            ? `<p style="color:#64748b;margin:16px 0;">Nenhum setor associado ao seu perfil.</p>`
            : `<table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead>
                    <tr style="background:#f8fafc;color:#64748b;font-size:12px;text-transform:uppercase;">
                        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Setor</th>
                        <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Planejado</th>
                        <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Realizado</th>
                        <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">%</th>
                    </tr>
                </thead>
                <tbody>${linhasSetores}</tbody>
               </table>`;

        const bodyHtml = `
            <div style="padding:4px;">
                <h2 style="color:#0d9488;margin:0 0 4px 0;font-size:18px;">Meu Canal — ${hoje}</h2>
                <p style="color:#64748b;margin:0 0 16px 0;font-size:14px;">Olá, <b>${userName}</b>. Resumo de performance dos seus setores.</p>
                ${semSetores}
                <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">MetalFisa ERP</p>
            </div>`;

        // 4. Enviar
        const transporter = nodemailer.createTransport({
            host: 'smtp.task.com.br',
            port: 587,
            secure: false,
            auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
            tls: { rejectUnauthorized: false }
        });

        const info = await transporter.sendMail({
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to: userEmail,
            subject: `Meu Canal — ${hoje}`,
            html: getCorporateEmailTemplate(bodyHtml)
        });

        res.json({ success: true, message: 'E-mail enviado para ' + userEmail, messageId: info.messageId });
    } catch (err) {
        console.error('Erro no disparo de teste Meu Canal:', err);
        res.status(500).json({ error: 'Erro ao enviar e-mail', detail: err.message });
    }
});

// =========================================================================
// ROTA POST PARA ENVIAR WHATSAPP DIRETO VIA EVOLUTION API
// =========================================================================
router.post('/test-whatsapp', authenticateToken, async (req, res) => {
    try {
        const { sendText, msgMeuCanal } = require('../services/whatsapp');
        
        const userLogin = req.user?.username || req.user?.login || req.user?.Login;
        
        // 1. Tentar resgatar o telefone real do usuário do banco MySQL
        const [uRows] = await mysql.query('SELECT telefone, idUsuario, NomeCompleto FROM usuario WHERE Login = ?', [userLogin]);
        const userTelefone = uRows[0]?.telefone;
        const userId = uRows[0]?.idUsuario;
        const userName = uRows[0]?.NomeCompleto || userLogin;

        const targetNumber = req.body.number || userTelefone;

        if (!targetNumber) {
            return res.status(400).json({ error: 'Seu usuário não possui um telefone (celular) cadastrado no sistema.' });
        }

        // 2. Calcular o KPI para o usuário atual
        const kpiData = await calcularKPIMeuCanal(userId, userLogin, userName);

        // 2. Usar o template do whatsapp
        const texto = msgMeuCanal({ nome: userName, setores: kpiData.setores });

        // 3. Enviar via Evolution API
        const resultado = await sendText(targetNumber, texto, `Meu Canal KPI - ${userName}`);

        res.json({ success: true, message: `Mensagem WhatsApp enviada para ${targetNumber}`, details: resultado });
    } catch (err) {
        console.error('Erro no disparo de WhatsApp Meu Canal:', err);
        res.status(500).json({ error: 'Erro ao enviar WhatsApp', detail: err.message });
    }
});

module.exports = router;
module.exports.calcularKPIMeuCanal = calcularKPIMeuCanal;
