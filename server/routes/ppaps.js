const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const db = require('../db'); // PostgreSQL (Protheus)
const nodemailer = require('nodemailer');
const { authenticateToken } = require('../routes/auth');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const SMTP_CONFIG = {
    host: 'smtp.task.com.br',
    port: 587,
    secure: false,
    auth: {
        user: 'sincometal@metalfisa.com.br',
        pass: 'Pro1042@sm'
    },
    tls: {
        rejectUnauthorized: false
    }
};

// --- Obter abas do arquivo Excel ---
router.post('/get-sheets', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const sheets = workbook.worksheets.map(ws => ws.name);
        res.json({ sheets });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler arquivo: ' + err.message });
    }
});

// --- Processar e preencher a planilha ---
router.post('/process-excel', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }
        
        const sheetName = req.body.sheetName; 
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        
        const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
        
        if (!worksheet) {
            return res.status(400).json({ error: 'Aba não encontrada no arquivo.' });
        }
        
        let processedCount = 0;
        let notFoundCount = 0;
        let duplicateCount = 0;
        let ignoredNotPpapCount = 0;

        const duplicatesLog = [];
        const ignoredNotPpapLog = [];

        // --- Pré-carrega o conjunto de produtos classificados como PPAP ---
        // A classificação vive em app_pedido_itens_classificacao (MySQL), por pedido+item —
        // não por produto. Cruzamos com o Protheus (sc6010) para descobrir quais PRODUTOS já
        // foram classificados como PPAP em algum pedido, e só preenchemos a planilha para esses.
        // Por definição, esta rotina só deve preencher itens cuja classificação seja PPAP.
        const mysqlPool = require('../services/mysqlService');
        const ppapProdutos = new Set();
        try {
            const [classifRows] = await mysqlPool.query(
                "SELECT DISTINCT pedido, item FROM app_pedido_itens_classificacao WHERE classificacao IN ('PPAP', 'Jits e PPAP')"
            );
            if (classifRows.length > 0) {
                const pares = classifRows.map(r => [String(r.pedido).trim(), String(r.item).trim()]);
                const values = pares.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
                const params = pares.flat();
                const prodRes = await db.query(
                    `SELECT DISTINCT TRIM(c6.c6_produto) as produto
                     FROM public.sc6010 c6
                     JOIN (VALUES ${values}) AS v(pedido, item) ON TRIM(c6.c6_num) = v.pedido AND TRIM(c6.c6_item) = v.item
                     WHERE COALESCE(c6.d_e_l_e_t_, '') = ''`,
                    params
                );
                prodRes.rows.forEach(r => ppapProdutos.add(r.produto));
            }
        } catch (errPPAP) {
            console.error('Erro ao carregar produtos classificados como PPAP:', errPPAP);
        }

        // As linhas começam em 4
        const rowCount = worksheet.rowCount;
        for (let r = 4; r <= rowCount; r++) {
            const row = worksheet.getRow(r);
            const valE = row.getCell('E').value;
            const valF = row.getCell('F').value;

            const getStringVal = (val) => {
                if (val === null || val === undefined) return '';
                if (typeof val === 'object') {
                    if (val.richText) return val.richText.map(t => t.text).join('').trim();
                    if (val.result !== undefined) return String(val.result).trim();
                    if (val.text) return String(val.text).trim();
                }
                return String(val).trim();
            };

            const strE = getStringVal(valE).toUpperCase();
            const strF = getStringVal(valF);

            if (strE && !strF) {
                // Realizar a busca no Protheus (PostgreSQL - tabela sz1010)
                const queryRes = await db.query('SELECT z1_produto FROM public.sz1010 WHERE RTRIM(z1_codcli) = $1 AND COALESCE(d_e_l_e_t_, \' \') = \' \'', [strE]);
                const rows = queryRes.rows;

                if (rows.length === 0) {
                    notFoundCount++;
                } else {
                    const uniqueProducts = [...new Set(rows.map(row => String(row.z1_produto).trim()))].filter(Boolean);
                    const ppapMatches = uniqueProducts.filter(p => ppapProdutos.has(p));

                    if (uniqueProducts.length > 0 && ppapMatches.length === 0) {
                        // Produto(s) encontrado(s), mas nenhum classificado como PPAP — não preenche.
                        ignoredNotPpapCount++;
                        ignoredNotPpapLog.push({ desenho: strE, produtos: uniqueProducts.join(', ') });
                    } else if (ppapMatches.length > 0) {
                        const cell = row.getCell('F');
                        cell.value = ppapMatches.join(' / ');

                        // Destacar a célula em azul claro para indicar preenchimento automático
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFD9E1F2' } // Light Blue
                        };

                        row.commit();
                        processedCount++;

                        if (ppapMatches.length > 1) {
                            duplicateCount++;
                            duplicatesLog.push({ desenho: strE, produtos: ppapMatches.join(', ') });
                        }
                    }
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();

        // Envio de E-mail de Resumo
        let userEmail = req.user?.email;
        if (!userEmail && req.user?.id) {
            try {
                const [userRows] = await mysqlPool.query('SELECT email FROM usuario WHERE idUsuario = ?', [req.user.id]);
                if (userRows && userRows.length > 0 && userRows[0].email) {
                    userEmail = userRows[0].email;
                }
            } catch (err) {
                console.error('Erro ao buscar email do usuario no MySQL:', err);
            }
        }
        userEmail = userEmail || 'ti@metalfisa.com.br';
        const userName = req.user?.nome || 'Usuário';
        
        try {
            const bodyContent = `
                <div style="padding: 10px 20px;">
                    <h2 style="color: #0d9488; margin-bottom: 5px;">Relatório de Processamento de PPAPs</h2>
                    <p style="color: #334155; font-size: 16px; margin-top: 0;">
                        Prezado(a) <strong>${userName}</strong>,
                    </p>
                    <p style="color: #475569; font-size: 15px;">
                        O processamento da rotina <strong>Integração PPAPs &harr; Protheus (SZ1)</strong> foi concluído com sucesso. Abaixo encontra-se o resumo técnico da operação solicitada.
                    </p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 25px 0;">
                        <h3 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Metadados do Processamento</h3>
                        
                        <table style="width: 100%; font-size: 14px; color: #475569; border-spacing: 0;">
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold; width: 45%;">Arquivo Fonte:</td>
                                <td style="padding: 6px 0;">${req.file.originalname}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold;">Aba Processada:</td>
                                <td style="padding: 6px 0;">${worksheet.name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold;">Data/Hora:</td>
                                <td style="padding: 6px 0;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold;">Registros Atualizados:</td>
                                <td style="padding: 6px 0; color: #059669; font-weight: bold;">${processedCount} <span style="font-size: 12px; color: #64748b; font-weight: normal;">(Marcados em Azul)</span></td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold;">Registros Não Encontrados:</td>
                                <td style="padding: 6px 0; color: #dc2626;">${notFoundCount}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold;">Inconsistências (Duplos):</td>
                                <td style="padding: 6px 0; color: #d97706; font-weight: bold;">${duplicateCount}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; font-weight: bold;">Ignorados (Produto sem Classificação PPAP):</td>
                                <td style="padding: 6px 0; color: #64748b; font-weight: bold;">${ignoredNotPpapCount}</td>
                            </tr>
                        </table>
                    </div>

                    ${ignoredNotPpapCount > 0 ? `
                        <div style="margin-top: 30px;">
                            <h3 style="color: #1e293b; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Ignorados — Produto sem Classificação PPAP</h3>
                            <p style="color: #64748b; font-size: 13px; margin-bottom: 15px;">O produto foi localizado na SZ1, mas não está classificado como "PPAP" (ou "Jits e PPAP") em nenhum pedido — por definição, esta rotina só preenche itens classificados como PPAP.</p>

                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead>
                                    <tr style="background-color: #f1f5f9;">
                                        <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; color: #334155;">Desenho Cliente</th>
                                        <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; color: #334155;">Produtos Localizados (não PPAP)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ignoredNotPpapLog.map(log => `
                                        <tr>
                                            <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${log.desenho}</td>
                                            <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${log.produtos}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    ${duplicateCount > 0 ? `
                        <div style="margin-top: 30px;">
                            <h3 style="color: #1e293b; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Log de Inconsistências (Múltiplos Produtos na SZ1)</h3>
                            <p style="color: #64748b; font-size: 13px; margin-bottom: 15px;">Os seguintes "Desenhos Cliente" retornaram mais de um código de "Produto MetalFisa" associado.</p>
                            
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead>
                                    <tr style="background-color: #f1f5f9;">
                                        <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; color: #334155;">Desenho Cliente</th>
                                        <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; color: #334155;">Produtos Localizados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${duplicatesLog.map(log => `
                                        <tr>
                                            <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${log.desenho}</td>
                                            <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${log.produtos}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
            `;

            const transporter = nodemailer.createTransport(SMTP_CONFIG);
            const mailOptions = {
                from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                to: userEmail,
                subject: 'PPAPs - Relatório de Processamento Excel',
                html: getCorporateEmailTemplate(bodyContent)
            };
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.error('Erro ao enviar e-mail resumo PPAPs:', mailErr);
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Processado_' + req.file.originalname + '"');
        return res.send(buffer);
        
    } catch (err) {
        console.error('Erro no PPAPs Process Excel:', err);
        res.status(500).json({ error: 'Erro interno: ' + err.message });
    }
});

module.exports = router;
