const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs').promises;
const path = require('path');

/**
 * Serviço de extração de dados de PDFs técnicos usando Google Gemini Vision API
 */
class PDFExtractionService {
    constructor(apiKey) {
        if (!apiKey || apiKey === 'sua_api_key_aqui') {
            throw new Error('GEMINI_API_KEY não configurada. Configure no arquivo .env');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.1, // Baixa temperatura para respostas mais consistentes
                topP: 1,
                topK: 32,
                maxOutputTokens: 2048,
            }
        });
    }

    /**
     * Extrai dados estruturados de um PDF de desenho técnico
     * @param {string} pdfPath - Caminho absoluto para o arquivo PDF
     * @returns {Promise<Object>} Dados extraídos estruturados
     */
    async extractFromPDF(pdfPath) {
        try {
            console.log(`🤖 Iniciando extração de dados: ${path.basename(pdfPath)}`);

            // Verificar se arquivo existe
            const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);
            if (!fileExists) {
                throw new Error(`Arquivo não encontrado: ${pdfPath}`);
            }

            // Ler PDF como base64
            const pdfBuffer = await fs.readFile(pdfPath);
            const pdfBase64 = pdfBuffer.toString('base64');

            // Prompt otimizado para desenhos técnicos brasileiros
            const prompt = `
Você é um especialista em análise de desenhos técnicos de engenharia mecânica.

Analise este desenho técnico e extraia as seguintes informações do CARIMBO/LEGENDA do desenho:

INFORMAÇÕES A EXTRAIR:
1. **Título do Desenho**: Nome/descrição da peça (ex: "CHAPA BASE", "SUPORTE LATERAL", etc)
2. **Peso**: Peso total da peça em quilogramas (kg)
3. **Área de Pintura**: Área total a ser pintada em metros quadrados (m²)
4. **Material**: Material principal da peça (ex: "AÇO 1020", "ALUMÍNIO", "AÇO INOX 304")
5. **Espessura**: Espessura do material em milímetros (mm)
6. **Dimensões**: Dimensões principais da peça (ex: "1000x500x300")
7. **Revisão**: Número ou letra da revisão do desenho (ex: "A", "B", "REV 01")

IMPORTANTE:
- Se algum dado NÃO estiver visível ou disponível no desenho, use null
- Para peso e área de pintura, extraia APENAS o valor numérico
- Seja preciso com os valores numéricos
- O título geralmente está no carimbo do desenho
- Área de pintura pode estar em dm² (divida por 100 para converter para m²)

RETORNE APENAS UM JSON VÁLIDO neste formato exato:
{
  "titulo": "string ou null",
  "peso_kg": number ou null,
  "area_pintura_m2": number ou null,
  "material": "string ou null",
  "espessura_mm": number ou null,
  "dimensoes": "string ou null",
  "revisao": "string ou null",
  "confianca": number (0.0 a 1.0, sua confiança na precisão dos dados extraídos)
}

NÃO adicione comentários, explicações ou texto extra. APENAS o JSON.
`;

            // Chamar Gemini Vision API
            const result = await this.model.generateContent([
                {
                    inlineData: {
                        data: pdfBase64,
                        mimeType: "application/pdf"
                    }
                },
                prompt
            ]);

            const response = await result.response.text();
            console.log(`📄 Resposta da IA (primeiros 200 chars): ${response.substring(0, 200)}...`);

            // Extrair JSON da resposta (remover markdown se houver)
            let jsonText = response.trim();

            // Remover blocos de código markdown se existirem
            jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            // Tentar encontrar o JSON no texto
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Não foi possível extrair JSON da resposta da IA');
            }

            const data = JSON.parse(jsonMatch[0]);

            // Validar estrutura
            const requiredFields = ['titulo', 'peso_kg', 'area_pintura_m2', 'material', 'espessura_mm', 'dimensoes', 'revisao', 'confianca'];
            const missingFields = requiredFields.filter(field => !(field in data));

            if (missingFields.length > 0) {
                console.warn(`⚠️ Campos ausentes na resposta: ${missingFields.join(', ')}`);
                // Adicionar campos faltantes como null
                missingFields.forEach(field => {
                    data[field] = field === 'confianca' ? 0.5 : null;
                });
            }

            // Garantir que confiança esteja entre 0 e 1
            if (data.confianca < 0 || data.confianca > 1) {
                data.confianca = 0.5;
            }

            console.log(`✅ Dados extraídos com sucesso! Confiança: ${(data.confianca * 100).toFixed(0)}%`);
            console.log(`   Título: ${data.titulo || 'N/A'}`);
            console.log(`   Peso: ${data.peso_kg ? data.peso_kg + ' kg' : 'N/A'}`);
            console.log(`   Área Pintura: ${data.area_pintura_m2 ? data.area_pintura_m2 + ' m²' : 'N/A'}`);

            return data;

        } catch (err) {
            console.error(`❌ Erro na extração de dados:`, err.message);
            throw err;
        }
    }

    /**
     * Extrai dados de múltiplos PDFs em lote
     * @param {Array<string>} pdfPaths - Array de caminhos de PDFs
     * @param {Function} onProgress - Callback de progresso (index, total, data)
     * @returns {Promise<Array<Object>>} Array de resultados
     */
    async extractBatch(pdfPaths, onProgress = null) {
        const results = [];

        for (let i = 0; i < pdfPaths.length; i++) {
            try {
                const data = await this.extractFromPDF(pdfPaths[i]);
                results.push({
                    path: pdfPaths[i],
                    success: true,
                    data
                });

                if (onProgress) {
                    onProgress(i + 1, pdfPaths.length, data);
                }

                // Rate limiting: aguardar 1 segundo entre requisições para evitar throttling
                if (i < pdfPaths.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (err) {
                console.error(`❌ Erro ao processar ${pdfPaths[i]}:`, err.message);
                results.push({
                    path: pdfPaths[i],
                    success: false,
                    error: err.message
                });
            }
        }

        return results;
    }
}

module.exports = PDFExtractionService;
