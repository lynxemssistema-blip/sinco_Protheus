import re

with open('server/routes/ai.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the prompt generation and call in document-assist
old_code = '''        const systemPrompt = `Você é um Assistente especializado em redigir documentos do Sistema de Gestão da Qualidade (SGQ) da MetalFisa.
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

${extraContext ? `CONTEXTO ADICIONAL FORNECIDO EM ANEXO:
${extraContext}` : ''}

Sua tarefa:
Forneça a melhoria, correção, ou adição solicitada, respeitando a estrutura do PQ da MetalFisa. 
Responda APENAS com o texto (ou HTML formatado de forma simples com p, b, i, ul, li) que deve ser inserido ou substituir o texto selecionado. 
Não inclua explicações extras como "Aqui está sua sugestão:", apenas retorne o conteúdo útil para ser copiado.`;

        const result = await model.generateContent(systemPrompt);'''

new_code = '''        const systemPrompt = `Você é um Assistente especializado em redigir documentos do Sistema de Gestão da Qualidade (SGQ) da MetalFisa.
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

        const result = await model.generateContent(parts);'''

c = c.replace(old_code, new_code)

with open('server/routes/ai.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("multimodal backend fixed")
