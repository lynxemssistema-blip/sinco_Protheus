/**
 * PCPMetal - Gemini Client
 * Wrapper for Google Gemini API with retry logic for transient errors.
 *
 * Model priority (stable → capable):
 *   gemini-2.5-flash  — primary (fast, stable, widely available)
 *   gemini-2.5-pro    — fallback (heavier, still stable)
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Primary model: stable, fast, always available
const DEFAULT_MODEL = 'gemini-2.5-flash';

// Fallback chain if primary fails with 503
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite'];

function getGeminiModel(modelName = DEFAULT_MODEL) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no .env');

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
        }
    });
}

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Determine if an error is retryable (503) or a hard fail (404, 400)
 */
function isRetryable(err) {
    const status = err?.status || err?.httpStatusCode;
    const msg = err?.message || '';
    return status === 503 || msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable');
}

/**
 * Single-turn query with automatic fallback through model list
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} preferredModel - Model from DB agent config
 * @returns {Promise<string>}
 */
async function askGemini(systemPrompt, userMessage, preferredModel = DEFAULT_MODEL) {
    const fullPrompt = `${systemPrompt}\n\n---\n## PERGUNTA DO USUÁRIO:\n${userMessage}`;

    // Build ordered model list: preferred first, then fallbacks (deduplicated)
    const modelsToTry = [preferredModel, ...MODEL_FALLBACKS.filter(m => m !== preferredModel)];

    let lastError;
    for (const modelName of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[PCPMetal] Tentando modelo: ${modelName} (tentativa ${attempt})`);
                const model = getGeminiModel(modelName);
                const result = await model.generateContent(fullPrompt);
                console.log(`[PCPMetal] ✅ Resposta obtida com: ${modelName}`);
                return result.response.text();
            } catch (err) {
                lastError = err;
                if (isRetryable(err)) {
                    if (attempt < 2) {
                        console.warn(`[PCPMetal] 503 em ${modelName}, aguardando 2s antes de retry...`);
                        await sleep(2000);
                    } else {
                        console.warn(`[PCPMetal] 503 persistente em ${modelName}, tentando próximo modelo...`);
                    }
                } else {
                    // non-retryable (404, 400) — skip to next model immediately
                    console.warn(`[PCPMetal] Erro não-retryável em ${modelName}: ${err.message}`);
                    break;
                }
            }
        }
    }

    throw lastError || new Error('Todos os modelos Gemini falharam.');
}

/**
 * Multi-turn conversation using chat history
 */
async function chatWithGemini(systemPrompt, history, userMessage, preferredModel = DEFAULT_MODEL) {
    const chatHistory = history.length > 0 ? history : [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido. Estou pronto para ajudar como PCPMetal. Por favor, faça sua pergunta.' }] }
    ];

    const modelsToTry = [preferredModel, ...MODEL_FALLBACKS.filter(m => m !== preferredModel)];
    let lastError;

    for (const modelName of modelsToTry) {
        try {
            const model = getGeminiModel(modelName);
            const chat = model.startChat({ history: chatHistory });
            const result = await chat.sendMessage(userMessage);
            return {
                text: result.response.text(),
                updatedHistory: [
                    ...chatHistory,
                    { role: 'user', parts: [{ text: userMessage }] },
                    { role: 'model', parts: [{ text: result.response.text() }] }
                ]
            };
        } catch (err) {
            lastError = err;
            if (isRetryable(err)) {
                await sleep(1500);
            }
        }
    }

    throw lastError || new Error('Todos os modelos Gemini falharam.');
}

/**
 * Parse SQL blocks from an LLM response
 * Returns array of { banco, sql } objects to execute
 */
function parseSQLFromResponse(responseText) {
    const queries = [];
    const regex = /```sql\s*([\s\S]*?)```/gi;
    let match;

    while ((match = regex.exec(responseText)) !== null) {
        const block = match[1].trim();
        const bancoMatch = block.match(/^\[BANCO:\s*(postgresql|mysql|pg)\]/i);
        const banco = bancoMatch ? bancoMatch[1].toLowerCase().replace('pg', 'postgresql') : 'postgresql';
        const sql = block.replace(/^\[BANCO:\s*(postgresql|mysql|pg)\]\s*/i, '').trim();
        if (sql) queries.push({ banco, sql });
    }

    return queries;
}

module.exports = { askGemini, chatWithGemini, parseSQLFromResponse, DEFAULT_MODEL };
