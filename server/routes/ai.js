const express = require('express');
const router = express.Router();
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
            model: "gemini-1.5-pro",
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
        
        // Em gemini-1.5-pro com responseMimeType json, ele retorna string JSON pura.
        const parsed = JSON.parse(responseText);

        res.json(parsed);

    } catch (err) {
        console.error('❌ Erro na rota AI /analyze-3d:', err);
        res.status(500).json({ error: err.message || 'Erro ao processar análise 3D com a IA.' });
    }
});

module.exports = router;
