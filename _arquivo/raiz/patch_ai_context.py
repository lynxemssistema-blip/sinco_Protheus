import re

with open('server/routes/ai.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Add pdf-parse import
if "const pdf = require('pdf-parse');" not in c:
    c = c.replace("const mammoth = require('mammoth');", "const mammoth = require('mammoth');\nconst pdf = require('pdf-parse');")

# Add the route for extracting text
route_code = '''
// Extract text from PDF or DOCX for AI context
router.post('/extract-context', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const ext = req.file.originalname.split('.').pop().toLowerCase();
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

        res.json({ text });
    } catch (err) {
        console.error('❌ Erro na extração de contexto:', err);
        res.status(500).json({ error: 'Falha ao extrair texto do arquivo.' });
    }
});
'''

if "/extract-context" not in c:
    # Insert before the import-word route
    c = c.replace("// Import Word (.docx) to HTML", route_code + "\n// Import Word (.docx) to HTML")

# Update document-assist route to accept extraContext
prompt_match = '''        const { documentContext, selectedText, prompt, modelName } = req.body;'''
prompt_repl = '''        const { documentContext, selectedText, prompt, modelName, extraContext } = req.body;'''
c = c.replace(prompt_match, prompt_repl)

prompt_body_match = '''INSTRUÇÃO DO USUÁRIO:
${prompt}

Sua tarefa:'''
prompt_body_repl = '''INSTRUÇÃO DO USUÁRIO:
${prompt}

${extraContext ? `CONTEXTO ADICIONAL FORNECIDO EM ANEXO:
${extraContext}` : ''}

Sua tarefa:'''
c = c.replace(prompt_body_match, prompt_body_repl)

with open('server/routes/ai.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("backend patched")
