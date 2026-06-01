const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

router.post('/document-assist', async (req, res) => {
    try {
        const { documentContext, selectedText, prompt, modelName, extraContext } = req.body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'sua_api_key_aqui') {
            return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: modelName || "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.4,
                topP: 1,
                topK: 32,
                maxOutputTokens: 2048,
            }
        });

        const systemPrompt = `Você é um Assistente especializado em redigir documentos do Sistema de Gestão da Qualidade (SGQ) da MetalFisa.
O usuário está escrevendo/editando um "Procedimento da Qualidade (PQ)" e precisa da sua ajuda.
A estrutura padrão deste documento é:
1. OBJETIVO, 2. ABRANGÊNCIA, 3. SIGLAS, 4. DEFINIÇÕES, 5. RESPONSABILIDADES, 6. PROCEDIMENTOS, 7. INFORMAÇÃO DOCUMENTADA, 8. ABORDAGEM A RISCOS, 9. ANEXOS, 10. HISTÓRICO DE REVISÕES.

Abaixo está o CONTEXTO GERAL (o texto completo do documento atual), o TEXTO SELECIONADO pelo usuário (se houver), e a INSTRUÇÃO do que ele quer.

CONTEXTO DO DOCUMENTO (EM HTML):
${documentContext || 'Nenhum contexto.'}

TEXTO SELECIONADO:
${selectedText || 'Nenhum texto selecionado.'}

INSTRUÇÃO DO USUÁRIO:
${prompt}

${extraContext && extraContext.type === 'text' ? `CONTEXTO ADICIONAL FORNECIDO EM ANEXO:
${extraContext.data}` : ''}

Sua tarefa:
Forneça a melhoria, correção, ou adição solicitada, respeitando a estrutura do PQ da MetalFisa. 
Responda APENAS com o texto (ou HTML formatado de forma simples com p, b, i, ul, li) que deve ser inserido ou substituir o texto selecionado. 
Não inclua explicações extras como "Aqui está sua sugestão:", apenas retorne o conteúdo útil para ser copiado.`;

        let parts = [{ text: systemPrompt }];
        
        if (extraContext && extraContext.type === 'image') {
            parts.unshift({
                inlineData: {
                    data: extraContext.data,
                    mimeType: extraContext.mimeType
                }
            });
        }

        const result = await model.generateContent(parts);
        const responseText = await result.response.text();

        res.json({ suggestion: responseText.trim() });

    } catch (err) {
        console.error('❌ Erro na rota AI /document-assist:', err);
        
        if (err.status === 429) {
            return res.status(429).json({ error: 'Cota de requisições excedida na API do Gemini. Tente novamente em um minuto.' });
        }
        
        res.status(500).json({ error: err.message || 'Erro ao processar instrução com IA' });
    }
});


// Extract text from PDF or DOCX for AI context
router.post('/extract-context', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const ext = req.file.originalname.split('.').pop().toLowerCase();
        
        if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
            return res.json({ 
                type: 'image', 
                mimeType: req.file.mimetype, 
                data: req.file.buffer.toString('base64') 
            });
        }

        let text = '';
        if (ext === 'pdf') {
            const data = await pdf(req.file.buffer);
            text = data.text;
        } else if (ext === 'docx' || ext === 'doc') {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
        } else {
            return res.status(400).json({ error: 'Formato não suportado. Use PDF, DOCX, ou Imagens (PNG/JPG).' });
        }

        // Limit text length
        if (text.length > 30000) {
            text = text.substring(0, 30000) + '... (texto truncado)';
        }

        res.json({ type: 'text', text });
    } catch (err) {
        console.error('❌ Erro na extração de contexto:', err);
        res.status(500).json({ error: 'Falha ao extrair texto do arquivo.' });
    }
});

// Import Word (.docx) to HTML
router.post('/import-word', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
        const html = result.value; // The generated HTML

        if (result.messages && result.messages.length > 0) {
            console.warn('⚠️ Avisos na importação do Word:', result.messages);
        }

        res.json({ html });
    } catch (err) {
        console.error('❌ Erro na importação do Word:', err);
        res.status(500).json({ error: 'Falha ao importar documento Word.' });
    }
});

// Export HTML to Word (.docx)
router.post('/export-word', async (req, res) => {
    try {
        const { htmlContent, title = 'Documento SGQ' } = req.body;

        if (!htmlContent) {
            return res.status(400).json({ error: 'O conteúdo HTML é necessário.' });
        }

        // HTML to DOCX conversion logic
        // This is a simplified fallback converter for the DOCX library.
        // For production, a more robust HTML parser like 'html-to-docx' is highly recommended.

        // We'll strip basic HTML tags to create standard paragraphs for now.
        const plainTextParts = htmlContent.replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/h[1-6]>/gi, '\n\n')
            .replace(/<[^>]+>/g, '') // Strip remaining tags
            .replace(/&nbsp;/ig, ' ')
            .split('\n')
            .filter(text => text.trim().length > 0);

        const paragraphs = plainTextParts.map(text => {
            return new Paragraph({
                children: [new TextRun(text)],
                spacing: { after: 200 }
            });
        });

        const doc = new Document({
            creator: "MetalFisa SGQ",
            title: title,
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        const b64string = await Packer.toBase64String(doc);
        res.json({ base64: b64string });

    } catch (err) {
        console.error('❌ Erro na exportação do Word:', err);
        res.status(500).json({ error: 'Falha ao exportar o documento para Word.' });
    }
});


// ==========================================
// ROTA: Análise 3D e Metrologia com Gemini
// ==========================================
router.post('/analyze-3d', async (req, res) => {
    try {
        const { img3D, imgCam, pdfData } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'sua_api_key_aqui') {
            return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliza o modelo pro para melhor visão espacial
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0.1, // Baixa temperatura para ser estritamente técnico
                responseMimeType: "application/json"
            }
        });

        const promptText = `Você é um Inspetor Metrológico e Agente de Qualidade Sênior da Indústria MetalMecânica.
A sua tarefa é comparar o "Modelo 3D" (Imagem 1) e a "Câmera / Peça Física" (Imagem 2).
Se o PDF do desenho técnico for fornecido (Documento 3), utilize-o como base absoluta das tolerâncias e dimensões.

Seja extremamente observador. Não repita os mesmos erros genéricos, olhe a imagem DE VERDADE.
Retorne um JSON estritamente com esta estrutura:
{
  "general_status": "Laudo geral da conformidade geométrica, montagem e solda. Mencione o que está bom e os desvios visuais.",
  "discrepancies": [
    {
      "description": "Explicação técnica da divergência (ex: furo ausente, solda indevida, desalinhamento, falta de fuso).",
      "coordinates": { "x": 0.2, "y": 0.3, "w": 0.1, "h": 0.1 }
    }
  ]
}

IMPORTANTE SOBRE AS COORDENADAS:
As coordenadas 'x', 'y', 'w', 'h' devem ser números decimais relativos entre 0.0 e 1.0 (onde 0,0 é o topo esquerdo e 1,1 o canto inferior direito), indicando onde o erro está localizado na IMAGEM DA CÂMERA (Imagem 2).
Gere no mínimo 1 e no máximo 4 discrepâncias reais observadas. Se a peça estiver perfeita (o que é raro sem gabarito), retorne discrepâncias vazias.`;

        let parts = [{ text: promptText }];

        if (img3D) {
            parts.push({
                inlineData: { data: img3D.split(',')[1], mimeType: "image/jpeg" }
            });
        }
        if (imgCam) {
            parts.push({
                inlineData: { data: imgCam.split(',')[1], mimeType: "image/jpeg" }
            });
        }
        if (pdfData) {
            // Se vier o base64 do PDF
            parts.push({
                inlineData: { data: pdfData.split(',')[1], mimeType: "application/pdf" }
            });
        }

        const result = await model.generateContent(parts);
        const responseText = await result.response.text();
        
        // Em gemini-2.5-pro com responseMimeType json, ele retorna string JSON pura.
        const parsed = JSON.parse(responseText);

        res.json(parsed);

    } catch (err) {
        console.error('❌ Erro na rota AI /analyze-3d:', err);
        res.status(500).json({ error: err.message || 'Erro ao processar análise 3D com a IA.' });
    }
});

// ==========================================
// ROTA: Estratégia de Fabricação com Gemini
// ==========================================
router.post('/manufacturing-strategy', async (req, res) => {
    try {
        const { orderData } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'sua_api_key_aqui') {
            return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        }

        // Busca capacidades dos recursos
        let capacidades = [];
        try {
            const [rows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
            capacidades = rows;
        } catch (e) {
            console.warn('Não foi possível buscar capacidades:', e.message);
        }

        // Busca a Estrutura de Produto (BOM) do Protheus
        let estruturasDeProduto = {};
        try {
            const db = require('../db');
            const pgClient = await db.connect();
            
            let codigosProduto = [];
            if (orderData.produto) {
                codigosProduto = [orderData.produto];
            } else if (orderData.itens) {
                codigosProduto = orderData.itens.map(i => i.produto).filter(Boolean);
            }
            
            if (codigosProduto.length > 0) {
                // Fetch first level BOM for these products
                const placeholders = codigosProduto.map((_, i) => `$${i+1}`).join(',');
                const bomQuery = `
                    WITH RECURSIVE
                    arvore AS (
                        SELECT
                            TRIM(g1.g1_cod) as pai_original,
                            TRIM(g1.g1_cod) as pai, 
                            TRIM(g1.g1_comp) as filho, 
                            CAST(REPLACE(CAST(g1.g1_quant AS text), ',', '.') AS numeric) as qtd, 
                            TRIM(b1.b1_desc) as descricao,
                            1 as nivel,
                            ARRAY[TRIM(g1.g1_cod)] as visitados
                        FROM public.sg1010 g1
                        LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')
                        WHERE TRIM(g1.g1_cod) IN (${placeholders})
                          AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')

                        UNION ALL

                        SELECT
                            a.pai_original,
                            TRIM(g1.g1_cod) as pai,
                            TRIM(g1.g1_comp) as filho,
                            CAST(REPLACE(CAST(g1.g1_quant AS text), ',', '.') AS numeric) as qtd,
                            TRIM(b1.b1_desc) as descricao,
                            a.nivel + 1,
                            a.visitados || TRIM(g1.g1_cod)
                        FROM arvore a
                        JOIN public.sg1010 g1 ON TRIM(g1.g1_cod) = a.filho AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
                        LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) AND COALESCE(b1.d_e_l_e_t_, '') IN ('', ' ')
                        WHERE a.nivel < 12
                          AND NOT (TRIM(g1.g1_cod) = ANY(a.visitados))
                    )
                    SELECT pai_original, pai, filho, qtd, descricao, nivel FROM arvore ORDER BY pai_original, nivel
                `;
                const bomResult = await pgClient.query(bomQuery, codigosProduto);
                
                bomResult.rows.forEach(row => {
                    const raiz = row.pai_original;
                    if (!estruturasDeProduto[raiz]) estruturasDeProduto[raiz] = [];
                    // Avoid inserting duplicates if the same sub-assembly is referenced multiple times in the hierarchy
                    const exists = estruturasDeProduto[raiz].some(e => e.pai === row.pai && e.filho === row.filho);
                    if (!exists) {
                        estruturasDeProduto[raiz].push({
                            nivel: row.nivel,
                            pai: row.pai,
                            filho: row.filho,
                            descricao: row.descricao,
                            qtd: row.qtd
                        });
                    }
                });
            }
            pgClient.release();
        } catch (e) {
            console.warn('Não foi possível buscar a estrutura do produto:', e.message);
        }

        const dataAtual = new Date().toLocaleDateString('pt-BR');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            }
        });

        const promptText = `Seu nome é "PCP Metal".
Você é um Diretor Industrial e Especialista Sênior em PCP (Planejamento e Controle da Produção).
A sua tarefa é analisar os dados reais de rastreabilidade de um pedido na fábrica, além das capacidades dos recursos e da estrutura do produto (BOM), e gerar uma estratégia de fabricação e um cronograma de alocação.

DATA ATUAL: ${dataAtual}

CAPACIDADES DOS RECURSOS (em minutos diários):
${JSON.stringify(capacidades, null, 2)}

ESTRUTURA DOS PRODUTOS DO PEDIDO (BOM / Engenharia):
${JSON.stringify(estruturasDeProduto, null, 2)}

DADOS DE RASTREABILIDADE MICRO (O Pedido em foco, com todas as OPs Pai e Filhas já geradas e saldo de entrega):
${JSON.stringify(orderData, null, 2)}

Sua análise deve obrigatoriamente conter:
1. **Visão Ampla da Fábrica:** Demonstre entender o contexto da fábrica e como as operações deste pedido se encaixam no cenário geral de recursos.
2. **Diagnóstico do Gargalo:** Qual é a operação, máquina ou OP que está atrasando o produto pai.
3. **Priorização por Data de Entrega (PCP):** A estratégia deve ser estritamente baseada na data de entrega do PCP, definindo a sequência de produção.
4. **Alocação de Datas Planejadas (Cronograma):** Com base na data atual, na capacidade de cada recurso (minutos por dia) e na demanda necessária de cada OP (pai/filha), você DEVE planejar as datas de início e fim de cada operação/recurso. Vá alocando as execuções cronologicamente para garantir o fluxo pai-filho. Apresente isso em formato de tabela.
5. **Lista de Peças Críticas (Faturamento Parcial ou Total):** Você deve SEMPRE retornar a lista exata das peças/componentes que fazem parte da estratégia para garantir a entrega.
6. **Estratégia de Ação Imediata:** O que o encarregado do chão de fábrica precisa fazer AGORA para desatar o nó.

Responda em linguagem direta, profissional, formato Markdown. Seja analítico, aponte datas específicas calculadas por você, códigos de peças, nomes de máquinas e defina claramente o que priorizar.`;

        console.log(`[AI Strategy] Enviando prompt para o Gemini. Tamanho: ${promptText.length} caracteres.`);
        const result = await model.generateContent(promptText);
        const responseText = await result.response.text();
        console.log(`[AI Strategy] Resposta recebida. Tamanho: ${responseText.length} caracteres.`);
        if (responseText.length < 50) {
            console.log(`[AI Strategy] Resposta suspeita: ${responseText}`);
        }
        
        const safeResponse = responseText && responseText.trim() ? responseText : "A IA não retornou nenhuma estratégia válida. O tamanho da resposta original foi 0.";
        res.json({ strategy: safeResponse });

    } catch (err) {
        console.error('❌ Erro na rota AI /manufacturing-strategy:', err);
        require('fs').writeFileSync('ai_error.log', err.stack || err.message || String(err));
        res.status(500).json({ error: err.message || 'Erro ao processar estratégia com a IA.' });
    }
});

module.exports = router;
