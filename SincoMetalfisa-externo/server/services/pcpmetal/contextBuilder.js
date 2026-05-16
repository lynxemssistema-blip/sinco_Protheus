/**
 * PCPMetal - Context Builder
 * Builds the AI system prompt from:
 *   1. The agent's base system_prompt (from DB)
 *   2. Schema context for known tables
 *   3. Current request context (order, client, product)
 */
const mysqlPool = require('../mysqlService');

/**
 * Loads all schema context rows from the DB
 */
async function loadSchemaContext() {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT banco, tabela, descricao, colunas_chave FROM pcpmetal_schema_context WHERE ativo = 1 ORDER BY banco, tabela'
        );
        return rows;
    } catch (err) {
        console.error('[ContextBuilder] Failed to load schema context:', err.message);
        return [];
    }
}

/**
 * Format schema context into readable text for the LLM
 */
function buildSchemaText(schemaRows) {
    const grouped = { postgresql: [], mysql: [] };
    schemaRows.forEach(r => {
        const db = r.banco || 'mysql';
        if (!grouped[db]) grouped[db] = [];
        grouped[db].push(r);
    });

    let text = '\n\n## ESTRUTURA DOS BANCOS DE DADOS DISPONÍVEIS:\n';

    for (const [banco, tables] of Object.entries(grouped)) {
        if (tables.length === 0) continue;
        text += `\n### ${banco.toUpperCase()} (${banco === 'postgresql' ? 'Protheus ERP' : 'App MetalFisa Interno'})\n`;
        tables.forEach(t => {
            text += `\n**Tabela: ${t.tabela}**\n${t.descricao}\n`;
            if (t.colunas_chave) {
                try {
                    const cols = JSON.parse(t.colunas_chave);
                    text += 'Colunas principais:\n';
                    for (const [col, desc] of Object.entries(cols)) {
                        text += `  - \`${col}\`: ${desc}\n`;
                    }
                } catch (_) { }
            }
        });
    }
    return text;
}

/**
 * Build full context string for a specific request
 */
function buildRequestContext({ pedido, item, cliente, produto, orderContext }) {
    let ctx = '';
    if (!pedido && !cliente && !produto) return ctx;

    ctx += '\n\n## CONTEXTO DA CONSULTA ATUAL:\n';
    if (pedido) ctx += `- **Pedido:** ${pedido}\n`;
    if (item) ctx += `- **Item:** ${item}\n`;
    if (cliente) ctx += `- **Cliente:** ${cliente}\n`;
    if (produto) ctx += `- **Produto:** ${produto}\n`;

    if (orderContext) {
        if (orderContext.pedido_header) {
            const h = orderContext.pedido_header;
            ctx += `\n**Dados do Pedido:**\n`;
            ctx += `  - Cliente: ${h.cliente || 'N/A'}\n`;
            ctx += `  - Emissão: ${h.c5_emissao || 'N/A'}\n`;
            ctx += `  - Nota Fiscal: ${h.c5_nota ? 'FATURADO' : 'Em aberto'}\n`;
        }

        if (orderContext.itens?.length > 0) {
            ctx += `\n**Itens do Pedido (${orderContext.itens.length} item(s)):**\n`;
            orderContext.itens.forEach(i => {
                ctx += `  - Item ${i.c6_item}: ${i.c6_produto} (${i.produto_desc}) | Qtd Vendida: ${i.c6_qtdven} | Entregue: ${i.c6_qtdent} | **Saldo: ${i.saldo}** | Entrega: ${i.c6_entreg} | OP: ${i.c6_op || 'N/A'}\n`;
            });
        }

        if (orderContext.planning_notes?.length > 0) {
            ctx += `\n**Planejamento PCP (App):**\n`;
            orderContext.planning_notes.forEach(n => {
                ctx += `  - Item ${n.item}: BOM liberada: ${n.bom_released_at || 'N/A'} | Início Mecânica: ${n.pcp_mech_start_date || 'N/A'} | Obs: ${n.pcp_notes || ''}\n`;
            });
        }

        if (orderContext.pcp_forecasts?.length > 0) {
            ctx += `\n**Previsões PCP Atualizadas:**\n`;
            orderContext.pcp_forecasts.forEach(f => {
                ctx += `  - Item ${f.item}: Prev. Entrega PCP: ${f.data_entrega_pcp} | Qtd: ${f.quantidade_pcp} | Atualizado por: ${f.usuario}\n`;
            });
        }
    }

    return ctx;
}

/**
 * Builds the full system prompt for a specific agent + request
 * @param {Object} agent - Agent DB row (system_prompt, contexto_negocio, etc.)
 * @param {Object} requestData - { pedido, item, cliente, produto, orderContext }
 * @param {Array} schemaRows - Loaded schema context rows
 */
function buildSystemPrompt(agent, requestData, schemaRows) {
    let prompt = agent.system_prompt || '';

    // Append business context
    if (agent.contexto_negocio) {
        prompt += `\n\n## CONTEXTO DE NEGÓCIO DA EMPRESA:\n${agent.contexto_negocio}`;
    }

    // Append schema
    const schemaText = buildSchemaText(schemaRows);
    prompt += schemaText;

    // Append current request context
    const reqCtx = buildRequestContext(requestData);
    if (reqCtx) prompt += reqCtx;

    // Add query tool instructions
    prompt += `\n\n## INSTRUÇÕES PARA CONSULTAS SQL:\n`;
    prompt += `Você pode solicitar a execução de consultas SQL indicando o formato:\n`;
    prompt += `\`\`\`sql\n[BANCO: postgresql ou mysql]\nSELECT ...\n\`\`\`\n`;
    prompt += `O sistema executará a consulta e retornará os dados para você analisar.\n`;
    prompt += `REGRAS OBRIGATÓRIAS:\n`;
    prompt += `- Apenas SELECT é permitido. Nunca UPDATE, INSERT, DELETE, DROP.\n`;
    prompt += `- Sempre filtre por d_e_l_e_t_ = '' nas tabelas Protheus.\n`;
    prompt += `- Limite resultados com LIMIT quando possível.\n`;
    prompt += `- Responses must be in Portuguese (Brazil).\n`;

    return prompt;
}

module.exports = { loadSchemaContext, buildSchemaText, buildRequestContext, buildSystemPrompt };
