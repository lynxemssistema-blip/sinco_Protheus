require('dotenv').config({ path: './server/.env' });
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUPORTE_INSTANCE = 'Suporte Lynx';
const SUPORTE_APIKEY = '1C62EE90D11A-4C75-B1BA-383CDF634A39';
const SUPORTE_GROUP_NAME = 'Metalfisa - Suporte Lynx';

async function sendIntro() {
    try {
        console.log('1. Buscando Grupos da Instância...');
        const groupsRes = await axios.get(`${process.env.EVOLUTION_API_URL}/group/fetchAllGroups/${encodeURIComponent(SUPORTE_INSTANCE)}?getParticipants=false`, {
            headers: { apikey: SUPORTE_APIKEY }
        });
        
        let targetGroupId = null;
        for (const group of groupsRes.data) {
            if (group.subject === SUPORTE_GROUP_NAME || group.name === SUPORTE_GROUP_NAME) {
                targetGroupId = group.id;
                break;
            }
        }

        if (!targetGroupId) {
            console.error('Grupo não encontrado!');
            return;
        }

        console.log(`2. Grupo encontrado: ${targetGroupId}. Gerando mensagem com Gemini...`);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        let helpContentText = '';
        try {
            helpContentText = fs.readFileSync(path.join(__dirname, 'client/src/config/helpContent.js'), 'utf8');
        } catch (e) { console.error('Erro ao ler helpContent.js:', e.message); }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: `Você é o Agente de IA de Suporte da Lynx. 
Sua base de conhecimento é este arquivo javascript:
${helpContentText.substring(0, 10000)}...

**Tarefa atual:** Escreva uma mensagem para enviar ao grupo "Metalfisa - Suporte Lynx" se apresentando formalmente para a equipe. Diga seu nome (Assistente IA da Lynx), sua função (ajudar com documentação do sistema MetalFisa SINCO, analisar prints de tela de erro e auxiliar em dúvidas), e o que você está lá para fazer. Mantenha um tom profissional, cordial, com emojis moderados, em português do Brasil e bem formatado para WhatsApp (com negritos e quebras de linha claras). Não invente que sabe fazer coisas fora do ERP SINCO.`
        });

        const result = await model.generateContent("Por favor, se apresente para o grupo agora.");
        const text = result.response.text();
        console.log("3. Mensagem gerada:\n", text);

        console.log('4. Enviando mensagem...');
        const sendUrl = `${process.env.EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(SUPORTE_INSTANCE)}`;
        await axios.post(sendUrl, {
            number: targetGroupId,
            text: text
        }, {
            headers: { apikey: SUPORTE_APIKEY }
        });

        console.log('✅ Mensagem de apresentação enviada com sucesso ao grupo!');
    } catch (e) {
        console.error('Falha:', e.message);
        if (e.response) console.error(e.response.data);
    }
}

sendIntro();
