import re

with open('server/routes/ai.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update extract-context route
old_extract = '''        const ext = req.file.originalname.split('.').pop().toLowerCase();
        let text = '';

        if (ext === 'pdf') {
            const data = await pdf(req.file.buffer);
            text = data.text;
        } else if (ext === 'docx' || ext === 'doc') {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
        } else {
            return res.status(400).json({ error: 'Formato não suportado. Use PDF ou DOCX.' });
        }

        // Limit text length to avoid token limits (approx 15000 chars)
        if (text.length > 30000) {
            text = text.substring(0, 30000) + '... (texto truncado por limite de tamanho)';
        }

        res.json({ text });'''

new_extract = '''        const ext = req.file.originalname.split('.').pop().toLowerCase();
        
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

        res.json({ type: 'text', text });'''

c = c.replace(old_extract, new_extract)

# 2. Update document-assist route
old_prompt = '''        const promptBody = `
Você é o assistente IA oficial do sistema SGQ da MetalFisa.
Você ajuda a redigir e revisar Fichas de Processo, Procedimentos Operacionais e Instruções de Trabalho da ISO 9001.

CONTEXTO DO DOCUMENTO ATUAL (Use apenas como base/referência):
${documentContext ? documentContext.substring(0, 5000) : 'Nenhum contexto.'}

INSTRUÇÃO DO USUÁRIO:
${prompt}

${extraContext ? `CONTEXTO ADICIONAL FORNECIDO EM ANEXO:
${extraContext}` : ''}

Sua tarefa:
Cumpra a instrução do usuário usando formatação HTML limpa. Se for texto simples, use <p>. Se for lista, use <ul><li>. Não use markdown (\`\`\`). Retorne SOMENTE o HTML resultante, pois ele será injetado diretamente no editor SunEditor.
`;

        const result = await model.generateContent(promptBody);'''

new_prompt = '''        const promptBody = `
Você é o assistente IA oficial do sistema SGQ da MetalFisa.
Você ajuda a redigir e revisar Fichas de Processo, Procedimentos Operacionais e Instruções de Trabalho da ISO 9001.

CONTEXTO DO DOCUMENTO ATUAL (Use apenas como base/referência):
${documentContext ? documentContext.substring(0, 5000) : 'Nenhum contexto.'}

INSTRUÇÃO DO USUÁRIO:
${prompt}

${extraContext && extraContext.type === 'text' ? `CONTEXTO ADICIONAL FORNECIDO EM ANEXO:
${extraContext.data}` : ''}

Sua tarefa:
Cumpra a instrução do usuário usando formatação HTML limpa. Se for texto simples, use <p>. Se for lista, use <ul><li>. Não use markdown (\`\`\`). Retorne SOMENTE o HTML resultante, pois ele será injetado diretamente no editor SunEditor.
`;

        let parts = [{ text: promptBody }];
        
        // Se houver uma imagem em anexo, inclui no prompt para o Gemini
        if (extraContext && extraContext.type === 'image') {
            parts.unshift({
                inlineData: {
                    data: extraContext.data,
                    mimeType: extraContext.mimeType
                }
            });
        }

        const result = await model.generateContent(parts);'''

c = c.replace(old_prompt, new_prompt)

with open('server/routes/ai.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("backend multimodal ready")
