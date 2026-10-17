import sys

filename = r"c:\Users\adm\Desktop\MetalFisa Anty\server\routes\ai.js"

with open(filename, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure mysqlPool is imported
if 'const mysqlPool = require(\'../services/mysqlService\');' not in content:
    content = content.replace("const router = express.Router();", "const router = express.Router();\nconst mysqlPool = require('../services/mysqlService');")

# Find the start and end of the manufacturing-strategy route
start_idx = content.find("router.post('/manufacturing-strategy'")
if start_idx != -1:
    # Find the end of the route (the module.exports = router; at the end)
    end_idx = content.find("module.exports = router;", start_idx)
    
    new_route = """router.post('/manufacturing-strategy', async (req, res) => {
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

        const dataAtual = new Date().toLocaleDateString('pt-BR');

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
A sua tarefa é analisar os dados reais de rastreabilidade de um pedido na fábrica, além das capacidades dos recursos, e gerar uma estratégia de fabricação e um cronograma de alocação.

DATA ATUAL: ${dataAtual}

CAPACIDADES DOS RECURSOS (em minutos diários):
${JSON.stringify(capacidades, null, 2)}

DADOS DE RASTREABILIDADE MICRO (O Pedido em foco, com todas as OPs Pai e Filhas):
${JSON.stringify(orderData, null, 2)}

Sua análise deve obrigatoriamente conter:
1. **Visão Ampla da Fábrica:** Demonstre entender o contexto da fábrica e como as operações deste pedido se encaixam no cenário geral de recursos.
2. **Diagnóstico do Gargalo:** Qual é a operação, máquina ou OP que está atrasando o produto pai.
3. **Priorização por Data de Entrega (PCP):** A estratégia deve ser estritamente baseada na data de entrega do PCP, definindo a sequência de produção.
4. **Alocação de Datas Planejadas (Cronograma):** Com base na data atual, na capacidade de cada recurso (minutos por dia) e na demanda necessária de cada OP (pai/filha), você DEVE planejar as datas de início e fim de cada operação/recurso. Vá alocando as execuções cronologicamente para garantir o fluxo pai-filho. Apresente isso em formato de tabela.
5. **Lista de Peças Críticas (Faturamento Parcial ou Total):** Você deve SEMPRE retornar a lista exata das peças/componentes que fazem parte da estratégia para garantir a entrega.
6. **Estratégia de Ação Imediata:** O que o encarregado do chão de fábrica precisa fazer AGORA para desatar o nó.

Responda em linguagem direta, profissional, formato Markdown. Seja analítico, aponte datas específicas calculadas por você, códigos de peças, nomes de máquinas e defina claramente o que priorizar.`;

        const result = await model.generateContent(promptText);
        const responseText = await result.response.text();
        
        res.json({ strategy: responseText });

    } catch (err) {
        console.error('❌ Erro na rota AI /manufacturing-strategy:', err);
        res.status(500).json({ error: err.message || 'Erro ao processar estratégia com a IA.' });
    }
});

"""
    
    content = content[:start_idx] + new_route + content[end_idx:]

with open(filename, 'w', encoding='utf-8') as f:
    f.write(content)
