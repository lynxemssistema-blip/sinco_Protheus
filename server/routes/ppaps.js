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
        
        const duplicatesLog = [];
        
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
                    
                    if (uniqueProducts.length > 0) {
                        const cell = row.getCell('F');
                        cell.value = uniqueProducts.join(' / ');
                        
                        // Destacar a célula em azul claro para indicar preenchimento automático
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFD9E1F2' } // Light Blue
                        };
                        
                        row.commit();
                        processedCount++;
                        
                        if (uniqueProducts.length > 1) {
                            duplicateCount++;
                            duplicatesLog.push({ desenho: strE, produtos: uniqueProducts.join(', ') });
                        }
                    }
                }
            }
        }
        
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Envio de E-mail de Resumo
        const mysqlPool = require('../services/mysqlService');
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
                                <td style="padding: 6px 0;">${new Date().toLocaleString('pt-BR')}</td>
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
                        </table>
                    </div>

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
