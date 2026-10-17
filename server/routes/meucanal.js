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
                    SELECT c2_datprf, c2_datpri 
                    FROM sc2010 
                    WHERE c2_num=$1 AND c2_item=$2 AND c2_sequen=$3 AND COALESCE(d_e_l_e_t_,' ')=' '
                `, [(ap.op_numero||'').trim().padStart(6, '0'), (ap.op_item||'').trim().padStart(2, '0'), (ap.op_sequencia||'').trim().padStart(3, '0')]);
                
                if (pgRes.rows.length > 0) {
                    const datprf = pgRes.rows[0].c2_datprf?.trim();
                    const datpri = pgRes.rows[0].c2_datpri?.trim();
                    if (datprf && datprf !== '20000101' && datprf !== '') {
                        temDataPlanejada = true;
                        // Converter AAAAMMDD do Protheus para Date
                        dataPlanejadaFim = new Date(`${datprf.slice(0,4)}-${datprf.slice(4,6)}-${datprf.slice(6,8)}`);
                        if (datpri && datpri !== '20000101' && datpri !== '') {
                            dataPlanejadaInicio = new Date(`${datpri.slice(0,4)}-${datpri.slice(4,6)}-${datpri.slice(6,8)}`);
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

        // ── Fase 2: Duas Etapas para evitar lentidão (Full Table Scan) ──
        const todosRecursos = [...new Set(setoresComRecursos.flatMap(s => s.recursos))];

        let todasOpsPlanejadas = [];
        if (todosRecursos.length > 0) {
            // Etapa 1: Buscar apenas as OPs planejadas para hoje
            const pgOpsRes = await db.query(`
                SELECT 
                    TRIM(c2_num) AS op_numero, 
                    TRIM(c2_item) AS op_item, 
                    TRIM(c2_sequen) AS op_sequencia, 
                    TRIM(c2_produto) AS produto, 
                    c2_quant::numeric AS qtd_planejada
                FROM sc2010
                WHERE c2_datprf = $1 AND COALESCE(d_e_l_e_t_, ' ') = ' '
            `, [todayStr]);

            const opsDoDia = pgOpsRes.rows;

            if (opsDoDia.length > 0) {
                const produtosUnicos = [...new Set(opsDoDia.map(op => op.produto))];

                // Etapa 2: Buscar os roteiros DESSES produtos que passam pelos RECURSOS dos setores
                const pgRotRes = await db.query(`
                    SELECT DISTINCT
                        TRIM(g2_produto) AS produto,
                        TRIM(g2_operac) AS operacao_codigo,
                        TRIM(g2_descri) AS operacao_nome,
                        TRIM(g2_recurso) AS recurso
                    FROM sg2010
                    WHERE TRIM(g2_produto) = ANY($1)
                      AND TRIM(g2_recurso) = ANY($2)
                      AND COALESCE(d_e_l_e_t_, ' ') = ' '
                `, [produtosUnicos, todosRecursos]);

                const roteiros = pgRotRes.rows;

                // Merge (Equivalente ao JOIN)
                for (const op of opsDoDia) {
                    const rotDoProduto = roteiros.filter(r => r.produto === op.produto);
                    for (const rot of rotDoProduto) {
                        // Usamos um set na lógica original ou push
                        todasOpsPlanejadas.push({
                            op_numero: op.op_numero,
                            op_item: op.op_item,
                            op_sequencia: op.op_sequencia,
                            produto: op.produto,
                            qtd_planejada: op.qtd_planejada,
                            operacao_codigo: rot.operacao_codigo,
                            operacao_nome: rot.operacao_nome,
                            recurso: rot.recurso
                        });
                    }
                }
            }
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
            if (perc > 50 && perc <= 75) { nivel = 'Atenção'; cor = '#f97316'; }
            else if (perc > 75 && perc <= 90) { nivel = 'Bom'; cor = '#eab308'; }
            else if (perc > 90) { nivel = 'Excelente'; cor = '#22c55e'; }

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
// TAREFAS DO PROJETISTA (usuários do setor ENGENHARIA)
// =========================================================================
async function calcularTarefasProjetista(nomeCompleto) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeSql = hoje.toISOString().slice(0, 10);

    // Tarefas ativas + concluídas nos últimos 7 dias
    const [tasks] = await mysql.query(`
        SELECT id, pedido, item, status, designer_name,
               designer_start_forecast, designer_end_forecast,
               designer_start_real, designer_end_real,
               designer_production_release_date, designer_notes, project_type, updated_at
        FROM app_sales_order_item_notes
        WHERE designer_name LIKE ?
          AND (status IN ('PENDENTE','EM_ANDAMENTO')
               OR (status = 'CONCLUIDO' AND designer_end_real >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)))
        ORDER BY
            CASE status WHEN 'EM_ANDAMENTO' THEN 0 WHEN 'PENDENTE' THEN 1 ELSE 2 END,
            designer_end_forecast ASC
    `, [`%${nomeCompleto}%`]);

    // Horas registradas hoje nos timesheets
    const [tsRows] = await mysql.query(`
        SELECT COALESCE(SUM(duration_seconds), 0) AS total_sec
        FROM app_engineering_timesheets
        WHERE usuario LIKE ? AND DATE(start_time) = ?
    `, [`%${nomeCompleto}%`, hojeSql]);
    const horasHoje = Math.round((tsRows[0]?.total_sec || 0) / 360) / 10;

    // Enriquecer com cliente + descrição do Protheus
    let pgMap = {};
    if (tasks.length > 0) {
        try {
            const pairs = tasks
                .map(t => `('${(t.pedido || '').trim().padStart(6, '0')}','${(t.item || '').trim().padStart(2, '0')}')`)
                .join(',');
            const pgRes = await db.query(`
                SELECT TRIM(c5.c5_num) AS pedido, TRIM(c6.c6_item) AS item,
                       TRIM(sa1.a1_nome) AS cliente, TRIM(sb1.b1_desc) AS descricao
                FROM sc6010 c6
                JOIN sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial
                    AND COALESCE(c5.d_e_l_e_t_, '') = ''
                LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli
                    AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c6.c6_produto
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE (c6.c6_num, c6.c6_item) IN (${pairs})
                  AND COALESCE(c6.d_e_l_e_t_, '') = ''
            `);
            for (const r of pgRes.rows) {
                pgMap[`${r.pedido}|${r.item}`] = { cliente: r.cliente, descricao: r.descricao };
            }
        } catch (e) {
            console.warn('[projetista] Enriquecimento Protheus falhou:', e.message);
        }
    }

    // Classificar e calcular prazos
    let atrasadas = 0, em_andamento = 0, pendentes = 0, concluidas_semana = 0;

    const tasksList = tasks.map(t => {
        const prazo = t.designer_end_forecast ? new Date(t.designer_end_forecast) : null;
        if (prazo) prazo.setHours(0, 0, 0, 0);
        const atrasada = prazo && prazo < hoje && t.status !== 'CONCLUIDO';
        const diasAtraso = atrasada ? Math.floor((hoje - prazo) / 86400000) : 0;
        const diasRestantes = (prazo && !atrasada && t.status !== 'CONCLUIDO')
            ? Math.floor((prazo - hoje) / 86400000) : null;

        const pg = pgMap[`${(t.pedido || '').trim()}|${(t.item || '').trim()}`] || {};

        if (t.status === 'CONCLUIDO') concluidas_semana++;
        else if (t.status === 'EM_ANDAMENTO') em_andamento++;
        else if (atrasada) atrasadas++;
        else pendentes++;

        return {
            id: t.id,
            pedido: t.pedido,
            item: t.item,
            status: t.status,
            projeto_tipo: t.project_type,
            data_inicio_plan: t.designer_start_forecast,
            data_fim_plan: t.designer_end_forecast,
            data_inicio_real: t.designer_start_real,
            data_fim_real: t.designer_end_real,
            atrasada,
            dias_atraso: diasAtraso,
            dias_restantes: diasRestantes,
            cliente: pg.cliente || null,
            descricao: pg.descricao || null,
            observacoes: t.designer_notes
        };
    });

    return {
        resumo: { atrasadas, em_andamento, pendentes, concluidas_semana, horas_hoje: horasHoje },
        tarefas: tasksList
    };
}

// =========================================================================
// ROTA GET DA TELA (Chamada pelo Frontend)
// =========================================================================
router.get('/kpi', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.idUsuario;
        const userLogin = req.user?.login || req.user?.Login;
        const userName = req.user?.nome || req.user?.NomeCompleto || userLogin;

        // Buscar foto, setor e nome completo do banco (não estão no payload JWT)
        const [userRows] = await mysql.query(
            'SELECT fotoUsuario, Setor, NomeCompleto FROM usuario WHERE idUsuario = ?',
            [userId]
        );
        const userFoto = userRows[0]?.fotoUsuario || null;
        const userSetor = (userRows[0]?.Setor || '').toUpperCase();
        const nomeCompleto = userRows[0]?.NomeCompleto || userName;
        const isProjetista = userSetor.includes('ENGENHAR');

        const data = await calcularKPIMeuCanal(userId, userLogin, userName);

        // Hora de cálculo para contexto no frontend
        data.horaCalculo = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        data.isProjetista = isProjetista;

        // Tarefas de engenharia (somente para projetistas)
        if (isProjetista) {
            data.tarefas_projetista = await calcularTarefasProjetista(nomeCompleto);
        }

        data.usuario = {
            id: userId,
            nome: userName,
            login: userLogin,
            foto: userFoto
        };

        res.json(data);
    } catch (err) {
        console.warn('[MEUCANAL /kpi FALLBACK]:', err.message);
        res.json({
            individual: { apontado: 0, pontuacao_bonus: 0, total_pontos: 0, apontamentos: [], categorias: {} },
            setores: [],
            horaCalculo: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            isProjetista: false,
            usuario: { id: req.user?.id, nome: req.user?.nome, login: req.user?.login }
        });
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
                <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">Lynx ERP</p>
            </div>`;

        // 4. Enviar pelo SMTP Oficial Hostinger
        const { sendMail } = require('../services/mailService');

        const info = await sendMail({
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
