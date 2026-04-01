const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../services/mysqlService');
const pdfParse = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/rh_curriculos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `cv-${uniqueSuffix}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Initialize Gemini Clients (primary + fallback)
const aiPrimary = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const aiAlt = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_ALT });

const generateWithFallback = async (params) => {
    try {
        return await aiPrimary.models.generateContent(params);
    } catch (err) {
        if (err.status === 429 || err.status === 404) {
            console.warn('⚠️ Gemini primary key failed (status ' + err.status + '), using fallback key...');
            return await aiAlt.models.generateContent(params);
        }
        throw err;
    }
};

// Extract text from legacy DOC (binary)
const extractDocText = (filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        let content = buffer.toString('latin1');
        content = content.replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, ' ').replace(/\s{2,}/g, ' ');
        return content;
    } catch {
        return "Erro ao extrair texto do DOC.";
    }
};

// GET /api/rh/vagas
router.get('/vagas', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT v.*, c.denominacao as cargo_nome 
            FROM app_rh_vagas v 
            JOIN app_sgq_cargos_funcoes c ON v.cargo_id = c.id 
            ORDER BY v.status ASC, v.id DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar vagas:', error);
        res.status(500).json({ error: 'Erro ao buscar vagas.' });
    }
});

// POST /api/rh/vagas
router.post('/vagas', async (req, res) => {
    try {
        const { cargo_id, titulo, descricao, requisitos_extras, status, data_abertura, data_fechamento } = req.body;
        const [result] = await db.query(`
            INSERT INTO app_rh_vagas (cargo_id, titulo, descricao, requisitos_extras, status, data_abertura, data_fechamento)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [cargo_id, titulo, descricao || '', requisitos_extras || '', status || 'Aberta', data_abertura || new Date(), data_fechamento || null]);
        res.status(201).json({ id: result.insertId, message: 'Vaga criada com sucesso' });
    } catch (error) {
        console.error('Erro ao criar vaga:', error);
        res.status(500).json({ error: 'Erro ao criar vaga.' });
    }
});

// PUT /api/rh/vagas/:id
router.put('/vagas/:id', async (req, res) => {
    try {
        const { cargo_id, titulo, descricao, requisitos_extras, status, data_abertura, data_fechamento } = req.body;
        await db.query(`
            UPDATE app_rh_vagas 
            SET cargo_id=?, titulo=?, descricao=?, requisitos_extras=?, status=?, data_abertura=?, data_fechamento=?
            WHERE id=?
        `, [cargo_id, titulo, descricao, requisitos_extras, status, data_abertura, data_fechamento, req.params.id]);
        res.json({ message: 'Vaga atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar vaga:', error);
        res.status(500).json({ error: 'Erro ao atualizar vaga.' });
    }
});

// GET /api/rh/curriculos
router.get('/curriculos', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                r.id, r.nome_candidato, r.telefone, r.email, r.status, 
                r.resumo_ai, r.comentarios, r.file_path, r.curriculo_texto, r.cargo_id, r.vaga_id, r.created_at,
                c.denominacao as cargo_nome,
                v.titulo as vaga_titulo
            FROM app_rh_curriculos r
            LEFT JOIN app_sgq_cargos_funcoes c ON r.cargo_id = c.id
            LEFT JOIN app_rh_vagas v ON r.vaga_id = v.id
            ORDER BY r.id DESC
        `);

        // Parse JSON fields safely since they are stored as TEXT
        const processedRows = rows.map(r => {
            let resumo_ai = null;
            let comentarios = [];
            try { resumo_ai = r.resumo_ai ? JSON.parse(r.resumo_ai) : null; } catch (e) {}
            try { comentarios = r.comentarios ? JSON.parse(r.comentarios) : []; } catch (e) {}
            return { ...r, resumo_ai, comentarios };
        });

        res.json(processedRows);
    } catch (error) {
        console.error('Erro ao listar curriculos:', error);
        res.status(500).json({ error: 'Erro ao consultar curriculos.' });
    }
});

// POST /api/rh/upload
router.post('/upload', upload.single('curriculo'), async (req, res) => {
    try {
        const { cargo_id, vaga_id, nome_candidato, email, telefone } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'Arquivo do currículo não enviado.' });
        if (!cargo_id) return res.status(400).json({ error: 'Cargo não selecionado.' });

        const filePath = file.path;
        let fileText = '';

        // Extract text based on extension
        if (file.originalname.toLowerCase().endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            fileText = data.text;
        } else if (file.originalname.toLowerCase().endsWith('.doc')) {
            fileText = extractDocText(filePath);
        } else {
            // For now, treat other formats via basic string buffer parsing (fallback) or mammuth if added later
            fileText = extractDocText(filePath);
        }

        // Fetch Cargo Details to send to AI
        const [cargoRows] = await db.query('SELECT * FROM app_sgq_cargos_funcoes WHERE id = ?', [cargo_id]);
        if (!cargoRows.length) return res.status(404).json({ error: 'Cargo não encontrado.' });
        const cargo = cargoRows[0];

        let vaga = null;
        if (vaga_id && vaga_id !== 'null' && vaga_id !== 'undefined') {
            const [vagaRows] = await db.query('SELECT * FROM app_rh_vagas WHERE id = ?', [vaga_id]);
            if (vagaRows.length) vaga = vagaRows[0];
        }

        // 1. Salvar no banco PRIMEIRO (antes da IA)
        const [insertResult] = await db.query(`
            INSERT INTO app_rh_curriculos
            (cargo_id, vaga_id, nome_candidato, telefone, email, file_path, curriculo_texto, resumo_ai, comentarios, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cargo_id,
            vaga_id && vaga_id !== 'null' ? vaga_id : null,
            nome_candidato || 'Nome não informado',
            telefone || null,
            email || null,
            file.filename,
            fileText,
            null,
            '[]',
            'Em Análise'
        ]);
        const newId = insertResult.insertId;

        // 2. Tentar análise com IA (se falhar, o registro já está salvo)
        let aiJson = null;
        try {
            let atividadesTxt = '';
            try {
                const arr = JSON.parse(cargo.atividades);
                atividadesTxt = Array.isArray(arr) ? arr.join('; ') : cargo.atividades;
            } catch { atividadesTxt = cargo.atividades; }

            let cargoDesc = `
                CARGO: ${cargo.denominacao}
                CBO: ${cargo.cbo || '-'}
                Educação Exigida: ${cargo.educacao || 'Não especificada'}
                Experiência Exigida: ${cargo.experiencia || 'Não especificada'}
                Treinamento Exigido: ${cargo.treinamento || 'Não especificado'}
                Atividades a realizar no cargo: ${atividadesTxt}
            `;
            if (vaga) {
                cargoDesc += `\n\nDETALHES DA VAGA ESPECÍFICA (${vaga.titulo}):\n`;
                cargoDesc += `Descrição da Vaga: ${vaga.descricao || 'N/A'}\n`;
                cargoDesc += `Requisitos Extras: ${vaga.requisitos_extras || 'N/A'}`;
            }

            const prompt = `
                Você é um Gerente de Recursos Humanos especialista em recrutamento e seleção industrial.
                Abaixo, temos o Perfil do Cargo / Vaga e as atividades que o candidato deverá exercer.
                E depois, temos o Currículo extraído do arquivo do candidato.

                Analise profundamente o currículo com base nas exigências da vaga. Você DEVE ler cada exigência do cargo e verificar no currículo se o candidato atende.
                
                Retorne a avaliação de aderência APENAS em um JSON estruturado da seguinte forma (e não use crases de markdown \`\`\`json):
                {
                    "nome_candidato": "Nome do candidato (muito importante extrair corretamente)",
                    "telefone": "Telefone extraído (ou null caso não localize)",
                    "email": "Email extraído (ou null caso não localize)",
                    "linkedin": "Link do linkedin (ou null)",
                    "cnh": "Categoria da CNH (ou null)",
                    "endereco": "Cidade / Estado (ou null)",
                    "score": <score GERAL de 0 a 10 indicando aderência geral ao cargo>,
                    "pontosForte": ["ponto 1", "ponto 2", "ponto 3"],
                    "pontosFracos": ["ponto 1", "ponto 2", "ponto 3"],
                    "resumo_gerencial": "Um texto avaliativo de 2 parágrafos com sua opinião clara de RH sobre o perfil.",
                    "adequacao_experiencia": "Adequado, Parcialmente Adequado ou Inadequado",
                    "adequacao_educacao": "Adequado, Parcialmente Adequado ou Inadequado",
                    "checklist": [
                        {
                            "requisito": "Ex: Experiência requerida do cargo ou Educação requerida",
                            "status": "Atendido", // Use exatamente: "Atendido", "Não Atendido", ou "Parcial"
                            "score": 8, // Nota inteira de 0 a 10 para este item
                            "justificativa": "Motivo do candidato ter sido avaliado assim neste requisito"
                        }
                    ],
                    "perguntas_entrevista": [
                        "Pergunta 1 direcionada para investigar uma lacuna ou confirmar uma experiência do candidato",
                        "Pergunta 2 técnica sobre conhecimento X exigido na vaga",
                        "Pergunta 3 comportamental relacionada ao perfil esperado"
                    ]
                }

                Importante sobre a avaliação:
                - Você deve destrinchar o Perfil da Vaga (atividades, educação, experiência, etc) em vários 'requisitos' no checklist.
                - Para CADA requisito da vaga, preencha o array "checklist" avaliando de 0 a 10.
                - Seja rígido. Candidatos com pouca permanência em empregos anteriores devem sofrer penalização significativa na pontuação geral.
                - Para o campo "linkedin", extraia a URL completa e contínua (NUNCA quebre em espaços ou duas linhas).
                - Gere 4 a 6 perguntas de entrevista ("perguntas_entrevista") altamente focadas no cargo/vaga e no que o candidato apresentou (ou deixou de apresentar) no currículo, formando um roteiro perfeito para a analista de RH usar na entrevista.

                == PERFIL DA VAGA ==
                ${cargoDesc}

                == CURRÍCULO DO CANDIDATO (${file.originalname}) ==
                ${fileText}
            `;

            console.log('🤖 Solicitando analise do Gemini...');
            const response = await generateWithFallback({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: { temperature: 0.2 }
            });

            let aiOutput = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
            try {
                aiJson = JSON.parse(aiOutput);
            } catch (e) {
                console.error("Failed to parse Gemini output:", aiOutput);
                aiJson = { score: 0, resumo_gerencial: "Erro interno da IA ao gerar json estruturado." };
            }

            // Atualizar registro com resultado da IA
            await db.query(`
                UPDATE app_rh_curriculos
                SET resumo_ai = ?, nome_candidato = ?, telefone = ?, email = ?, status = 'Em Avaliação'
                WHERE id = ?
            `, [
                JSON.stringify(aiJson),
                aiJson.nome_candidato || nome_candidato || 'Nome não informado',
                aiJson.telefone || telefone || null,
                aiJson.email || email || null,
                newId
            ]);
        } catch (aiErr) {
            console.error('⚠️ IA falhou, currículo salvo sem análise. ID:', newId, aiErr.message);
        }

        res.status(201).json({
            message: aiJson ? 'Currículo importado e analisado.' : 'Currículo salvo. Análise de IA indisponível no momento — use "Reavaliar" quando a cota for renovada.',
            id: newId,
            resumo_ai: aiJson
        });

    } catch (error) {
        console.error('Erro no upload RH:', error);
        res.status(500).json({ error: 'Erro processando upload.' });
    }
});

// PUT /api/rh/curriculos/:id/vaga
router.put('/curriculos/:id/vaga', async (req, res) => {
    try {
        const { vaga_id } = req.body;
        await db.query('UPDATE app_rh_curriculos SET vaga_id = ? WHERE id = ?', [vaga_id || null, req.params.id]);
        res.json({ message: 'Vaga vinculada ao candidato com sucesso.' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao vincular vaga' });
    }
});

// PUT /api/rh/curriculos/:id/status
router.put('/curriculos/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await db.query('UPDATE app_rh_curriculos SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status atualizado' });
    } catch {
        res.status(500).json({ error: 'Erro ao atualizar status.' });
    }
});

// PUT /api/rh/curriculos/:id/comentarios
router.put('/curriculos/:id/comentarios', async (req, res) => {
    try {
        const { comentario, autor } = req.body;
        
        // Fetch current comments
        const [rows] = await db.query('SELECT comentarios FROM app_rh_curriculos WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Currículo não encontrado.' });
        
        let comList = [];
        try {
            let dbCom = rows[0].comentarios;
            if (typeof dbCom === 'string') {
                comList = dbCom ? JSON.parse(dbCom) : [];
            } else if (Array.isArray(dbCom)) {
                comList = dbCom;
            }
        } catch (e) {}

        comList.push({
            id: Date.now(),
            texto: comentario,
            autor: autor || 'Sistema',
            data: new Date().toISOString()
        });

        await db.query('UPDATE app_rh_curriculos SET comentarios = ? WHERE id = ?', [JSON.stringify(comList), req.params.id]);
        res.json({ message: 'Comentário adicionado', comentarios: comList });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao adicionar comentário.' });
    }
});

// GET /api/rh/curriculos/download/:filename
router.get('/curriculos/download/:filename', (req, res) => {
    const file = path.join(__dirname, '../uploads/rh_curriculos', req.params.filename);
    res.download(file);
});

// POST /api/rh/curriculos/:id/upload
router.post('/curriculos/:id/upload', upload.single('curriculo'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Arquivo não enviado.' });

        const filePath = file.path;
        let fileText = '';

        if (file.originalname.toLowerCase().endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            fileText = data.text;
        } else {
            fileText = extractDocText(filePath);
        }

        await db.query(`
            UPDATE app_rh_curriculos
            SET file_path = ?, curriculo_texto = ?, resumo_ai = NULL
            WHERE id = ?
        `, [file.filename, fileText, req.params.id]);

        res.json({ message: 'Arquivo substituído! Clique em "Reavaliar com IA".', file_path: file.filename, curriculo_texto: fileText });
    } catch (error) {
        console.error('Erro no re-upload RH:', error);
        res.status(500).json({ error: 'Erro processando upload.' });
    }
});

// POST /api/rh/curriculos/:id/reavaliar
router.post('/curriculos/:id/reavaliar', async (req, res) => {
    try {
        const id = req.params.id;
        const [candRows] = await db.query('SELECT * FROM app_rh_curriculos WHERE id = ?', [id]);
        if (!candRows.length) return res.status(404).json({ error: 'Currículo não encontrado.' });
        
        const cand = candRows[0];
        const [cargoRows] = await db.query('SELECT * FROM app_sgq_cargos_funcoes WHERE id = ?', [cand.cargo_id]);
        if (!cargoRows.length) return res.status(400).json({ error: 'Cargo associado a este currículo não foi encontrado (talvez tenha sido deletado).' });
        
        const cargo = cargoRows[0];

        let vaga = null;
        if (cand.vaga_id && cand.vaga_id !== 'null' && cand.vaga_id !== 'undefined') {
            const [vRows] = await db.query('SELECT * FROM app_rh_vagas WHERE id = ?', [cand.vaga_id]);
            if (vRows.length) vaga = vRows[0];
        }

        let atividadesTxt = '';
        try { const arr = JSON.parse(cargo.atividades); atividadesTxt = Array.isArray(arr) ? arr.join('; ') : cargo.atividades; } 
        catch { atividadesTxt = cargo?.atividades || ''; }

        let comTxt = '';
        let comentariosArr = [];
        try { comentariosArr = JSON.parse(cand.comentarios || '[]'); } catch(e){}
        if (comentariosArr.length > 0) {
            comTxt = comentariosArr.map(c => `[${c.autor} em ${new Date(c.data).toLocaleDateString()}]: ${c.texto}`).join('\n');
        }

        const prompt = `
            Você é um Gerente de Recursos Humanos especialista em recrutamento.
            Abaixo estão os dados da Vaga, o Currículo do candidato, e os COMENTÁRIOS ADICIONADOS PELA EQUIPE DE RH.
            Você deve REAVALIAR o candidato levando em extrema consideração essas novas observações da equipe.

            Você DEVE ler cada exigência do cargo e verificar no currículo se o candidato atende.
            Retorne a avaliação de aderência APENAS em um JSON estruturado (sem crases de markdown):
            {
                "nome_candidato": "Nome do candidato (muito importante extrair corretamente)",
                "telefone": "Telefone extraído (ou null)",
                "email": "Email extraído (ou null)",
                "linkedin": "Link do linkedin (ou null)",
                "cnh": "Categoria da CNH (ou null)",
                "endereco": "Cidade / Estado (ou null)",
                "score": <score GERAL de 0 a 10 indicando aderência geral ao cargo e influenciado pelos comentários do RH>,
                "pontosForte": ["ponto 1", "ponto 2", "ponto 3"],
                "pontosFracos": ["ponto 1", "ponto 2", "ponto 3"],
                "resumo_gerencial": "Um texto avaliativo atualizado com sua opinião de RH, MENCIONANDO os pontos levantados pela equipe se houverem.",
                "adequacao_experiencia": "Adequado, Parcialmente Adequado ou Inadequado",
                "adequacao_educacao": "Adequado, Parcialmente Adequado ou Inadequado",
                "checklist": [
                    {
                        "requisito": "Ex: Experiência requerida do cargo ou premissa do RH",
                        "status": "Atendido", // Use: "Atendido", "Não Atendido", ou "Parcial"
                        "score": 8, // Nota inteira de 0 a 10
                        "justificativa": "Motivo da avaliação neste requisito (incluindo notas do RH se aplicável)"
                    }
                ]
            }

            == PERFIL DO CARGO / VAGA ==
            CARGO: ${cargo.denominacao}
            Educação: ${cargo.educacao || '-'}
            Experiência: ${cargo.experiencia || '-'}
            Treinamento: ${cargo.treinamento || '-'}
            Atividades: ${atividadesTxt}
            ${vaga ? `\nDETALHES DA VAGA (${vaga.titulo}):\nDescrição: ${vaga.descricao || '-'}\nRequisitos Extras: ${vaga.requisitos_extras || '-'}` : ''}

            == COMENTÁRIOS DA EQUIPE DE RH (MUITO IMPORTANTE) ==
            ${comTxt || 'Nenhum comentário adicional.'}

            == CURRÍCULO DO CANDIDATO (${cand.file_path}) ==
            ${cand.curriculo_texto}
        `;

        const response = await generateWithFallback({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { temperature: 0.2 }
        });

        let aiOutput = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        let aiJson;
        try {
            aiJson = JSON.parse(aiOutput);
        } catch (parseError) {
            console.error("Falha ao fazer parse do JSON na reavaliação:", aiOutput);
            return res.status(500).json({ error: 'A IA gerou uma resposta malformada ou a resposta é longa demais. Tente novamente.' });
        }

        await db.query('UPDATE app_rh_curriculos SET resumo_ai = ?, nome_candidato = COALESCE(?, nome_candidato), telefone = COALESCE(?, telefone), email = COALESCE(?, email) WHERE id = ?', [
            JSON.stringify(aiJson), 
            aiJson?.nome_candidato || null, 
            aiJson?.telefone || null, 
            aiJson?.email || null, 
            id
        ]);

        res.json({ message: 'Reavaliação concluída', resumo_ai: aiJson });
    } catch (error) {
        console.error('Erro ao reavaliar:', error);
        const isQuota = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('quota');
        if (isQuota) {
            return res.status(503).json({ error: 'Cota da IA esgotada. Tente novamente mais tarde (renova à meia-noite).' });
        }
        res.status(500).json({ error: 'Erro interno ao reavaliar. Tente novamente.' });
    }
});

module.exports = router;
