const cron = require('node-cron');
const mysqlPool = require('../mysqlService');
const { orchestrateHermes } = require('./orchestrator');
const nodemailer = require('nodemailer');
const { sendText } = require('../whatsapp');

// Map of currently scheduled jobs: task_id -> cron task instance
const activeJobs = new Map();

async function executeTask(task) {
    console.log(`[HermesScheduler] Iniciando execução da tarefa "${task.nome}" (ID: ${task.id})`);
    
    // Set status to 'running'
    try {
        await mysqlPool.query(
            'UPDATE hermes_tasks SET status_last_run = ?, last_run = NOW() WHERE id = ?',
            ['running', task.id]
        );
    } catch (err) {
        console.error('[HermesScheduler] Erro ao marcar status de início da tarefa:', err.message);
    }

    const steps = [];
    const localEmit = (event) => {
        if (event.type === 'step' || event.type === 'sql') {
            steps.push(`[${event.icon || '▶'}] ${event.message}`);
        }
    };

    try {
        const result = await orchestrateHermes({
            userMessage: task.prompt_execucao,
            requestContext: {},
            pageData: null,
            userId: 0, // system
            historico: [],
            emit: localEmit,
            profileId: task.perfil_id,
            temperature: task.temperature,
            autonomia: task.autonomia
        });

        // Task succeeded
        await mysqlPool.query(
            'UPDATE hermes_tasks SET status_last_run = ?, last_run = NOW() WHERE id = ?',
            ['success', task.id]
        );

        console.log(`[HermesScheduler] Tarefa "${task.nome}" concluída com sucesso!`);

        // Send Email if configured
        if (task.alerta_email && task.alerta_email.trim()) {
            try {
                const transporter = nodemailer.createTransport({
                    host: 'smtp.task.com.br',
                    port: 587,
                    secure: false,
                    auth: { user: 'sincometal@metalfisa.com.br', pass: 'Pro1042@sm' },
                    tls: { rejectUnauthorized: false }
                });

                const subject = `🤖 Hermes Agent Task: ${task.nome}`;
                
                // Formata os logs em lista limpa
                const stepsList = steps.map(s => `<div style="padding:4px 0; border-bottom:1px solid #312e81; color:#c7d2fe;">${s}</div>`).join('');
                
                const body = `
                    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <div style="background-color: #4f46e5; color: white; padding: 24px; text-align: center;">
                            <h2 style="margin: 0; font-size: 20px; font-weight: bold;">Hermes AI Agent</h2>
                            <p style="margin: 6px 0 0 0; opacity: 0.85; font-size: 13px;">Relatório automático gerado pelo agendador de tarefas</p>
                        </div>
                        <div style="padding: 24px; color: #334155; line-height: 1.6;">
                            <h3 style="margin-top: 0; color: #1e1b4b; font-size: 16px;">Tarefa: ${task.nome}</h3>
                            <p style="font-size: 13px; color: #64748b; margin-top: -8px;">${task.descricao || 'Sem descrição'}</p>
                            
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                            
                            <h4 style="color: #4f46e5; margin-bottom: 8px; font-size: 14px; font-weight: bold;">Resumo das Ações / Conclusão:</h4>
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; color: #1e293b; white-space: pre-wrap; font-family: sans-serif;">${result.answer}</div>
                            
                            <h4 style="color: #4f46e5; margin-top: 24px; margin-bottom: 8px; font-size: 14px; font-weight: bold;">Logs de Raciocínio:</h4>
                            <div style="background-color: #1e1b4b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; max-height: 250px; overflow-y: auto;">
                                ${stepsList}
                            </div>
                        </div>
                        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
                            Este e-mail é gerado automaticamente pelo módulo Hermes da MetalFisa.
                        </div>
                    </div>
                `;

                await transporter.sendMail({
                    from: '"MetalFisa Hermes" <sincometal@metalfisa.com.br>',
                    to: task.alerta_email,
                    subject,
                    html: body
                });
                console.log(`[HermesScheduler] Relatório de e-mail enviado para: ${task.alerta_email}`);
            } catch (mailErr) {
                console.error('[HermesScheduler] Erro ao enviar e-mail de alerta:', mailErr.message);
            }
        }

        // Send WhatsApp if configured
        if (task.alerta_whatsapp && task.alerta_whatsapp.trim()) {
            try {
                const waText = `*🤖 HERMES AI AGENT — TAREFA CONCLUÍDA*\n📌 *Tarefa:* ${task.nome}\n\n*Resumo das Ações:*\n${result.answer.slice(0, 1500)}${result.answer.length > 1500 ? '...' : ''}\n\n_Relatório gerado automaticamente pelo MetalFisa Hermes_`;
                await sendText(task.alerta_whatsapp, waText, `Hermes Task: ${task.nome}`);
                console.log(`[HermesScheduler] Relatório WhatsApp enviado para: ${task.alerta_whatsapp}`);
            } catch (waErr) {
                console.error('[HermesScheduler] Erro ao enviar WhatsApp de alerta:', waErr.message);
            }
        }

    } catch (err) {
        console.error(`[HermesScheduler] Falha na execução da tarefa "${task.nome}":`, err.message);
        try {
            await mysqlPool.query(
                'UPDATE hermes_tasks SET status_last_run = ?, last_run = NOW() WHERE id = ?',
                ['failed', task.id]
            );
        } catch (dbErr) {
            console.error('[HermesScheduler] Erro ao atualizar status de falha no banco:', dbErr.message);
        }
    }
}

async function startHermesScheduler() {
    console.log('[HermesScheduler] Inicializando agendador do Hermes...');
    try {
        const [tasks] = await mysqlPool.query('SELECT * FROM hermes_tasks WHERE ativo = 1');
        for (const task of tasks) {
            scheduleTaskInstance(task);
        }
        console.log(`[HermesScheduler] ${tasks.length} tarefa(s) agendada(s) com sucesso.`);
    } catch (err) {
        console.error('[HermesScheduler] Falha ao iniciar agendador:', err.message);
    }
}

function scheduleTaskInstance(task) {
    if (activeJobs.has(task.id)) {
        activeJobs.get(task.id).stop();
        activeJobs.delete(task.id);
    }

    if (!task.ativo) return;

    try {
        const cronJob = cron.schedule(task.cron_expression, async () => {
            try {
                const [rows] = await mysqlPool.query('SELECT * FROM hermes_tasks WHERE id = ?', [task.id]);
                if (rows.length > 0 && rows[0].ativo) {
                    await executeTask(rows[0]);
                }
            } catch (err) {
                console.error(`[HermesScheduler] Falha ao buscar detalhes atualizados da tarefa ${task.id}:`, err.message);
            }
        });
        activeJobs.set(task.id, cronJob);
        console.log(`[HermesScheduler] Agendada tarefa "${task.nome}" (ID: ${task.id}) com cron: ${task.cron_expression}`);
    } catch (cronErr) {
        console.error(`[HermesScheduler] Expressão cron inválida para tarefa "${task.nome}" (ID: ${task.id}):`, task.cron_expression);
    }
}

function stopTaskInstance(taskId) {
    if (activeJobs.has(taskId)) {
        activeJobs.get(taskId).stop();
        activeJobs.delete(taskId);
        console.log(`[HermesScheduler] Tarefa ID ${taskId} parada na memória.`);
    }
}

module.exports = {
    startHermesScheduler,
    scheduleTaskInstance,
    stopTaskInstance,
    executeTaskImmediately: executeTask
};
