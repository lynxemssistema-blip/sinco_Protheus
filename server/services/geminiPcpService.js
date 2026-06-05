const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysqlPool = require('./mysqlService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analisa o relatório FCS com contexto histórico e retorna análise estruturada em PT-BR.
 * Quanto mais contexto histórico, mais precisa a análise.
 * @param {Object} report - Relatório FCS enriquecido com contexto histórico
 */
async function analisarRelatorioFCS(report) {
    const resumoRecursos = Object.values(report.resumo_recursos || {});
    const decisoes = report.decisoes || [];
    const ctx = report.contexto_historico || {};

    // -- Seção 1: Capacidade e carga atual dos recursos --
    const seçaoRecursos = resumoRecursos.map(r => {
        const pct = r.capacidade_diaria_min > 0
            ? Math.round((r.total_minutos_alocados / r.capacidade_diaria_min) * 100)
            : '?';
        return `  • ${r.recurso} (${r.desc_recurso || r.recurso}): cap=${r.capacidade_diaria_min}min/dia | alocado=${r.total_minutos_alocados}min | ${pct}% ocupado | ${r.total_operacoes} ops`;
    }).join('\n');

    // -- Seção 2: Gargalos desta execução --
    const gargalos = decisoes.filter(d => d.excede_capacidade_dia);
    const seçaoGargalos = gargalos.length > 0
        ? gargalos.map(d =>
            `  • OP ${d.op_numero} / Op.${d.operacao} / ${d.recurso}: ${d.total_minutos_necessarios}min (${d.capacity_pct}% da cap.), ${d.dias_necessarios} dia(s) necessários`
        ).join('\n')
        : '  • Nenhum gargalo detectado nesta execução.';

    // -- Seção 3: Histórico de uso dos recursos (últimos 90 dias) --
    const seçaoHistorico = (ctx.utilizacao_recursos_90d || []).length > 0
        ? ctx.utilizacao_recursos_90d.map(h =>
            `  • ${h.recurso_codigo} / Op.${h.operacao_codigo}: ${h.total_revisoes} registros, ${h.total_dias_planejados} dias planejados (${h.ultima_alocacao?.toISOString?.()?.split('T')[0] || h.ultima_alocacao})`
        ).join('\n')
        : '  • Sem histórico dos últimos 90 dias.';

    // -- Seção 4: Padrões de alteração manual (indício de problemas recorrentes) --
    const seçaoAlteracoes = (ctx.padroes_alteracao_60d || []).length > 0
        ? ctx.padroes_alteracao_60d.map(a =>
            `  • OP ${a.op_numero} / Op.${a.operacao_codigo}: ${a.qtd_alteracoes}x alterado por ${a.usuario} (origem: ${a.origem})`
        ).join('\n')
        : '  • Sem alterações manuais recentes registradas.';

    // -- Seção 5: Carga futura já planejada (próximos 30 dias) --
    const seçaoCargaFutura = (ctx.carga_futura_30d || []).length > 0
        ? ctx.carga_futura_30d.map(c =>
            `  • ${c.recurso_codigo}: ${c.dias_com_producao} dias com produção, ${c.total_ops_planejadas} ops | de ${c.proximo_inicio?.toISOString?.()?.split('T')[0] || c.proximo_inicio} até ${c.ultimo_fim?.toISOString?.()?.split('T')[0] || c.ultimo_fim}`
        ).join('\n')
        : '  • Nenhuma carga futura planejada nos próximos 30 dias.';

    // Configurações padrão de fallback
    let systemPrompt = `Você é um especialista sênior em Planejamento e Controle da Produção (PCP) industrial para uma empresa metalúrgica de médio porte chamada MetalFisa.
Seu papel é analisar o resultado de um planejamento gerado pelo algoritmo FCS (Finite Capacity Scheduling) e fornecer uma análise técnica aprofundada.`;
    let contextoNegocio = `=== CONTEXTO DA EMPRESA ===
- Empresa: MetalFisa (metalurgia, produção sob encomenda e para estoque)
- Todos os tempos são em MINUTOS
- Dias úteis = segunda a sexta-feira (sem fins de semana)
- Capacidade diária = definida por recurso em minutos/dia`;
    let modeloNome = 'gemini-2.0-flash';

    try {
        const [rows] = await mysqlPool.query(
            "SELECT system_prompt, contexto_negocio, modelo FROM pcpmetal_agentes WHERE nome = 'Planejamento Inteligente' AND ativo = 1 LIMIT 1"
        );
        if (rows && rows.length > 0) {
            if (rows[0].system_prompt) systemPrompt = rows[0].system_prompt;
            if (rows[0].contexto_negocio) contextoNegocio = rows[0].contexto_negocio;
            if (rows[0].modelo) modeloNome = rows[0].modelo;
        }
    } catch (err) {
        console.warn('⚠️ Não foi possível carregar o agente Planejamento Inteligente do banco, usando fallback:', err.message);
    }

    const model = genAI.getGenerativeModel({ model: modeloNome });

    const prompt = `
${systemPrompt}

=== CONTEXTO DE NEGÓCIO ===
${contextoNegocio}

=== DADOS DO PLANEJAMENTO ATUAL ===
Data base: ${report.data_base}
Planejador: ${report.planejador}
OPs analisadas: ${report.total_ops}
Operações sequenciadas: ${report.total_operacoes_planejadas}

=== CAPACIDADE E CARGA DOS RECURSOS ===
${seçaoRecursos}

=== GARGALOS DETECTADOS NESTA EXECUÇÃO ===
${seçaoGargalos}

=== HISTÓRICO DE UTILIZAÇÃO DOS RECURSOS (últimos 90 dias) ===
${seçaoHistorico}

=== PADRÕES DE ALTERAÇÃO MANUAL DO PCP (últimos 60 dias) ===
${seçaoAlteracoes}

=== CARGA JÁ PLANEJADA NOS PRÓXIMOS 30 DIAS ===
${seçaoCargaFutura}

=== INSTRUÇÕES ===
Com base em TODOS os dados acima (planejamento atual + histórico + carga futura), realize uma análise técnica completa.
Considere padrões históricos: se um recurso é constantemente gargalo, sinalize isso.
Se há alterações manuais frequentes em uma OP, isso indica problema estrutural (roteiro incorreto, tempo errado, etc.).
Se um recurso já tem muita carga futura e ainda vai receber mais, sinalize o risco de congestionamento.

Responda EXCLUSIVAMENTE em JSON válido com esta estrutura exata (sem markdown):
{
  "resumo_executivo": "3-4 linhas descrevendo o planejamento, contexto geral e estado da produção.",
  "analise_capacidade": "Análise técnica da capacidade dos recursos, cruzando com histórico e carga futura.",
  "analise_gargalos": "Análise detalhada dos gargalos, identificando se são estruturais (recorrentes) ou pontuais.",
  "padroes_detectados": "Padrões identificados no histórico que impactam decisões futures.",
  "sugestoes": [
    "Sugestão 1 — objetiva, acionável e específica para MetalFisa",
    "Sugestão 2 — objetiva, acionável e específica para MetalFisa",
    "Sugestão 3 — objetiva, acionável e específica para MetalFisa"
  ],
  "alertas": [
    "Alerta crítico se houver risco real de atraso ou congestionamento"
  ],
  "indicador_confianca": "ALTO | MÉDIO | BAIXO",
  "justificativa_confianca": "Explicação do nível de confiança baseado na qualidade dos dados disponíveis."
}
`;

    const result = await model.generateContent(prompt);
    const raw = await result.response.text();
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        return {
            resumo_executivo: raw.substring(0, 500),
            analise_capacidade: '',
            analise_gargalos: '',
            padroes_detectados: '',
            sugestoes: ['Análise parcial — verifique os dados do relatório.'],
            alertas: [],
            indicador_confianca: 'BAIXO',
            justificativa_confianca: 'Erro ao interpretar resposta do modelo.'
        };
    }
}

module.exports = { analisarRelatorioFCS };
