import sys
import json

filename = r"c:\Users\adm\Desktop\MetalFisa Anty\server\routes\ai.js"

with open(filename, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:189]

append_text = """
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
Gere no mínimo 1 e no máximo 4 discrepâncias reais observadas. Se a peça estiver perfeita (o que é raro sem gabarito), retorne discrepâncias vazias.\`;

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

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro",
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            }
        });

        const promptText = `Seu nome é "PCP Metal".
Você é um Diretor Industrial e Especialista Sênior em PCP (Planejamento e Controle da Produção).
A sua tarefa é analisar os dados reais de rastreabilidade de um pedido na fábrica, além do contexto MACRO da fábrica, e gerar uma estratégia de fabricação de alto nível.

DADOS DE RASTREABILIDADE MICRO (O Pedido em foco):
${JSON.stringify(orderData, null, 2)}

Sua análise deve obrigatoriamente conter:
1. **Visão Ampla da Fábrica:** Demonstre entender o contexto da fábrica e como as operações deste pedido se encaixam no cenário geral de recursos.
2. **Diagnóstico do Gargalo:** Qual é a operação, máquina ou OP que está atrasando o produto pai.
3. **Lista de Peças Críticas (Faturamento Parcial ou Total):** Você deve SEMPRE retornar a lista exata das peças/componentes que fazem parte da estratégia de ataque para garantir a entrega (seja sugerindo um faturamento parcial do que já está pronto, ou o faturamento total).
4. **Estratégia de Ação Imediata:** O que o encarregado do chão de fábrica precisa fazer AGORA para desatar o nó.

Responda em linguagem direta, profissional, formato Markdown. Seja analítico, aponte códigos de peças, nomes de máquinas e defina claramente o que priorizar.\`;

        const result = await model.generateContent(promptText);
        const responseText = await result.response.text();
        
        res.json({ strategy: responseText });

    } catch (err) {
        console.error('❌ Erro na rota AI /manufacturing-strategy:', err);
        res.status(500).json({ error: err.message || 'Erro ao processar estratégia com a IA.' });
    }
});

module.exports = router;
"""

with open(filename, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    f.write(append_text)
