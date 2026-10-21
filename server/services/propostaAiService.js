const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Serviço de Inteligência Artificial para estudo do prospecto/cliente e geração de propostas comerciais
 */
class PropostaAiService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ [PropostaAiService] GEMINI_API_KEY não configurada no .env');
        }
        this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    }

    /**
     * Faz um scraping seguro e leve de páginas públicas do site informado
     */
    async scrapeWebsite(url) {
        if (!url) return null;
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        try {
            const parsed = new URL(cleanUrl);

            // Validações Anti-SSRF rigorosas
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return null;
            }

            const hostname = parsed.hostname.toLowerCase();

            // Bloqueia loopback, localhost e nomes internos sem domínio
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1' || !hostname.includes('.')) {
                console.warn(`[SSRF Prevention] Bloqueada tentativa de acesso a host local: ${hostname}`);
                return null;
            }

            // Bloqueia faixas de IP privadas (RFC 1918) e Cloud Metadata (169.254.169.254)
            const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/.test(hostname);
            if (isPrivateIp || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) {
                console.warn(`[SSRF Prevention] Bloqueada tentativa de acesso a IP/rede privada: ${hostname}`);
                return null;
            }

            // Bloqueia portas internas não padrão
            if (parsed.port && !['80', '443'].includes(parsed.port)) {
                console.warn(`[SSRF Prevention] Bloqueada tentativa de acesso a porta não padrão: ${parsed.port}`);
                return null;
            }

            const response = await axios.get(cleanUrl, {
                timeout: 10000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            const html = response.data || '';
            
            // Extração de tags meta e textos relevantes sem dependências externas pesadas
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : '';

            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) 
                           || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
            const description = descMatch ? descMatch[1].trim() : '';

            // Limpa scripts e estilos para extrair texto limpo
            const cleanText = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
                .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
                .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            return {
                url: cleanUrl,
                title,
                description,
                snippet: cleanText.substring(0, 4500) // Primeiros 4.500 caracteres úteis
            };
        } catch (err) {
            console.warn(`⚠️ [PropostaAiService] Falha ao raspar ${cleanUrl}: ${err.message}`);
            return {
                url: cleanUrl,
                error: err.message,
                snippet: ''
            };
        }
    }

    /**
     * Gera proposta técnico-comercial personalizada analisando o cliente via Gemini
     */
    async gerarPropostaComIA({ nomeCliente, site, instagram, setor, focoOperacional }) {
        if (!this.genAI) {
            throw new Error('Chave GEMINI_API_KEY não configurada no servidor (.env).');
        }

        // 1. Scraping preliminar do site se informado
        let siteData = null;
        if (site) {
            siteData = await this.scrapeWebsite(site);
        }

        const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
Você é o Diretor Comercial & Arquiteto de Soluções Industriais da LYNX Soluções Corporativas (Ecossistema SINCO).
Sua missão é estudar o cliente abaixo e estruturar uma PROPOSTA TÉCNICO-COMERCIAL de alto nível, personalizada e aderente à realidade dele.

DADOS FORNECIDOS DO CLIENTE:
- Nome da Empresa: "${nomeCliente || 'Cliente'}"
- Setor Declarado: "${setor || 'Indústria / Engenharia / Serviços'}"
- Site Oficial: "${site || 'Não informado'}"
- Instagram: "${instagram || 'Não informado'}"
- Foco Operacional / Dores: "${focoOperacional || 'Melhorar controle fabril, segurança, qualidade e apontamento de obras'}"

DADOS EXTRAÍDOS DO SITE DA EMPRESA:
${siteData?.snippet ? `Título: ${siteData.title}\nDescrição: ${siteData.description}\nConteúdo Principal: ${siteData.snippet}` : 'Não foi possível extrair dados automáticos do site. Use as informações declaradas e o perfil da empresa.'}

O ECOSSISTEMA SINCO OFERECE:
- Mobilidade operacional total para chão de fábrica e canteiros de obras remotos (diários digitais, apontamento tátil, requisições de campo).
- Conexão e integração universal com qualquer ERP do mercado (com conectores prontos para TOTVS Protheus, Omie, Sankhya, SAP, Senior, etc.) ou operação 100% autônoma. O Protheus é apenas uma das opções de referência.
- Módulo SST (Saúde e Segurança do Trabalho): compliance com NRs, controle de EPIs, registros de inspeções e segurança em campo.
- Módulo SGQ (Sistema de Gestão da Qualidade): suporte à NBR ISO 9001, gestão de RNCs, procedimentos e calibrações.
- Módulo Gestão Fabril: ordens de produção, apontamentos de máquinas, tempos-padrão e montagem com integração a qualquer ERP.
- Módulo Gestão de Campo: acompanhamento do avanço físico de obras e equipes.
- Módulo Solicitações de Campo: canal oficial Canteiro ↔ Matriz.
- Módulos de Roadmap Futuro: Almoxarifado, Compras, Gestão Financeira.
- Metodologia de Implantação: Inovação Ágil baseada em MVP (Imersão de 60 dias, liberação em ciclos, sem escopo engessado).
- Modelo Comercial SaaS: Setup inicial (Mês 1 e 2) + Sustentação a partir do 3º mês em múltiplos de Salários Mínimos com franquia de canteiros de obra.

INSTRUÇÕES DE RESPOSTA:
Retorne ESTRITAMENTE um objeto JSON (sem markdown de bloco \`\`\`json, apenas o JSON puro) com a seguinte estrutura:

{
  "cliente_nome": "${nomeCliente}",
  "cliente_razao_social": "Razão social estimada ou informada",
  "cliente_site": "${site || ''}",
  "cliente_instagram": "${instagram || ''}",
  "cliente_telefone": "Telefone identificado ou (00) 0000-0000",
  "cliente_email": "contato@empresa.com.br",
  "setor": "Setor detalhado com base no estudo",
  "titulo": "Implementação do Ecossistema SINCO",
  "contexto": "Texto detalhado de 2 a 3 parágrafos analisando a operação real do cliente, seu tempo de mercado, seu porte, tipos de obras/fábrica e o porquê de o Ecossistema SINCO ser a solução ideal para conectar a matriz, a fábrica e o campo com rastreabilidade total, mobilidade nativa e integração flexível com qualquer ERP (Protheus, Omie, Sankhya, etc.).",
  "escopo_fase1": [
    { "id": "sst", "nome": "Módulo SST (Saúde e Segurança do Trabalho)", "descricao": "Justificativa específica para a operação deste cliente.", "status": "Contemplado (Imediato)" },
    { "id": "sgq", "nome": "Módulo SGQ (Sistema de Gestão da Qualidade)", "descricao": "Justificativa específica com base nas certificações ou exigências do cliente.", "status": "Contemplado (Imediato)" },
    { "id": "gestao_fabril", "nome": "Módulo Gestão Fabril", "descricao": "Justificativa específica para a produção/montagem deste cliente.", "status": "Contemplado (Imediato)" },
    { "id": "gestao_campo", "nome": "Módulo Gestão de Campo", "descricao": "Justificativa específica para as obras ou montagens externas deste cliente.", "status": "Contemplado (Imediato)" },
    { "id": "solicitacoes_campo", "nome": "Módulo Solicitações de Campo", "descricao": "Canal oficial canteiro-matriz adaptado para este cliente.", "status": "Contemplado (Imediato)" }
  ],
  "escopo_fase2": [
    { "id": "almoxarifado", "nome": "Módulo Almoxarifado", "status": "Roadmap Futuro (Fora do escopo atual)" },
    { "id": "compras", "nome": "Módulo Compras", "status": "Roadmap Futuro (Fora do escopo atual)" },
    { "id": "financeiro", "nome": "Módulo Gestão Financeira", "status": "Roadmap Futuro (Fora do escopo atual)" }
  ],
  "metodologia": {
    "titulo": "Inovação Ágil (MVP - Produto Mínimo Viável)",
    "descricao": "Texto adaptado destacando a imersão de 60 dias da Lynx para a realidade deste cliente.",
    "pilares": [
      { "titulo": "Imersão de 60 Dias", "descricao": "Dedicação intensiva e exclusiva da Lynx nos primeiros 2 meses para adaptação profunda." },
      { "titulo": "Aceleração de Valor e Uso Imediato", "descricao": "O software começa a rodar em ciclos para testes reais no dia a dia da empresa." },
      { "titulo": "Foco na Assertividade", "descricao": "Sem escopo burocrático engessado: evolução orgânica conforme os gargalos reais identificados." }
    ]
  },
  "checkpoint": {
    "prazo_dias": 60,
    "descricao": "Ao término dos primeiros 60 dias de imersão, a LYNX emitirá um Relatório Técnico de Entrega detalhando o status das funcionalidades, acompanhado de uma Pesquisa de Satisfação para validação de continuidade."
  },
  "infraestrutura": [
    "Acesso exclusivo via ambiente web próprio: https://${(nomeCliente || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '')}.lynxems.com.br.",
    "Infraestrutura completa de Servidor Web e Banco de Dados em nuvem com alta disponibilidade.",
    "Rotinas automáticas de Backup de segurança de todos os dados operacionais.",
    "Todo o custo de desenvolvimento contínuo, manutenção e atualizações do App inclusos."
  ],
  "investimento": {
    "setup_fase_agil": {
      "mes1_valor": 16520.60,
      "mes2_valor": 16520.60,
      "descricao": "Referente à dedicação intensiva de desenvolvimento nos primeiros 60 dias de projeto (Impostos inclusos)."
    },
    "sustentacao_mensal": {
      "vigor": "A partir do 3º mês (após aprovação do checkpoint dos 60 dias)",
      "valor_base_salarios_minimos": 6,
      "franquia_canteiros": 15,
      "acrescimo_por_canteiro_extra_sm": 0.5,
      "descricao_escalabilidade": "O sistema cresce de forma justa: para cada canteiro de obra ativo que ultrapasse a franquia (15), acréscimo de 0,5 salário mínimo por canteiro extra naquele mês.",
      "autonomia_gestao": "Autonomia e Transparência Total: O gerenciamento de ativação e encerramento de canteiros é de controle exclusivo da empresa, cessando imediatamente cobranças adicionais ao inativar a obra."
    },
    "regras_faturamento": {
      "emissao_nf": "Todo dia 28 de cada mês",
      "vencimento": "Previsto para o dia 10 do mês subsequente"
    }
  }
}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extração de JSON seguro
        let parsedJson = null;
        try {
            const cleaned = responseText
                .replace(/^```json/gm, '')
                .replace(/^```/gm, '')
                .trim();
            parsedJson = JSON.parse(cleaned);
        } catch (jsonErr) {
            console.error('❌ Falha ao fazer parse do JSON gerado pela IA:', jsonErr.message);
            console.log('Conteúdo retornado:', responseText);
            throw new Error('A IA não retornou um formato JSON válido. Tente novamente.');
        }

        return parsedJson;
    }
}

module.exports = new PropostaAiService();
