const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mammoth = require('mammoth');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

router.post('/document-assist', async (req, res) => {
    try {
        const { documentContext, selectedText, prompt } = req.body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'sua_api_key_aqui') {
            return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                temperature: 0.4,
                topP: 1,
                topK: 32,
                maxOutputTokens: 2048,
            }
        });

        const systemPrompt = `Você é um Assistente especializado em redigir documentos do Sistema de Gestão da Qualidade (SGQ) com base na ISO 9001. 
O usuário está escrevendo/editando um documento e precisa da sua ajuda.
Abaixo está o CONTEXTO GERAL (o texto completo do documento atual), o TEXTO SELECIONADO pelo usuário (se houver), e a INSTRUÇÃO do que ele quer.

CONTEXTO DO DOCUMENTO (EM HTML):
${documentContext || 'Nenhum contexto.'}

TEXTO SELECIONADO:
${selectedText || 'Nenhum texto selecionado.'}

INSTRUÇÃO DO USUÁRIO:
${prompt}

Sua tarefa:
Forneça a melhoria, correção, ou adição solicitada. 
Responda APENAS com o texto (ou HTML formatado de forma simples com p, b, i, ul, li) que deve ser inserido ou substituir o texto selecionado. 
Não inclua explicações extras como "Aqui está sua sugestão:", apenas retorne o conteúdo útil para ser copiado.`;

        const result = await model.generateContent(systemPrompt);
        const responseText = await result.response.text();

        res.json({ suggestion: responseText.trim() });

    } catch (err) {
        console.error('❌ Erro na rota AI /document-assist:', err);
        res.status(500).json({ error: err.message || 'Erro ao processar instrução com IA' });
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

module.exports = router;
