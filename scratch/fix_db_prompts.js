require('dotenv').config({ path: 'server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function main() {
    try {
        const [agents] = await mysqlPool.query('SELECT * FROM pcpmetal_agentes');
        
        for (const agent of agents) {
            let updatedPrompt = agent.system_prompt;
            let updatedContext = agent.contexto_negocio;
            let updated = false;

            if (updatedPrompt) {
                // Correct table lists
                if (updatedPrompt.includes('SC5010, SC6010, SC9010, SH6010')) {
                    updatedPrompt = updatedPrompt.replace('SC5010, SC6010, SC9010, SH6010', 'SC5010, SC6010, SC2010, SC9010, SH6010');
                    updated = true;
                }
                if (updatedPrompt.includes('SC5010, SC6010, SC9010, SH6010, SA1010, SB1010')) {
                    updatedPrompt = updatedPrompt.replace('SC5010, SC6010, SC9010, SH6010, SA1010, SB1010', 'SC5010, SC6010, SC2010, SC9010, SH6010, SA1010, SB1010');
                    updated = true;
                }
            }

            if (updatedContext) {
                // Correct context descriptions
                if (updatedContext.includes('SC9010 (cabeçalho da OP)')) {
                    updatedContext = updatedContext.replace(/SC9010 \(cabeçalho da OP\)/g, 'SC2010 (cabeçalho da OP)');
                    updated = true;
                }
                if (updatedContext.includes('SC9010.C9_DATPRF')) {
                    updatedContext = updatedContext.replace(/SC9010\.C9_DATPRF/g, 'SC2010.C2_DATPRF');
                    updated = true;
                }
                if (updatedContext.includes('C9_DATPRF')) {
                    updatedContext = updatedContext.replace(/C9_DATPRF/g, 'C2_DATPRF');
                    updated = true;
                }
                if (updatedContext.includes('SC9010.C9_STATUS')) {
                    updatedContext = updatedContext.replace(/SC9010\.C9_STATUS/g, 'SC2010.C2_STATUS');
                    updated = true;
                }
                if (updatedContext.includes('C9_STATUS')) {
                    updatedContext = updatedContext.replace(/C9_STATUS/g, 'C2_STATUS');
                    updated = true;
                }
                if (updatedContext.includes('SC9010 (cabeçalho da OP) no PostgreSQL/Protheus.')) {
                    updatedContext = updatedContext.replace('SC9010 (cabeçalho da OP) no PostgreSQL/Protheus.', 'SC2010 (cabeçalho da OP) no PostgreSQL/Protheus.');
                    updated = true;
                }
                if (updatedContext.includes('SC9010 do Protheus com app_production_appointments')) {
                    updatedContext = updatedContext.replace('SC9010 do Protheus com app_production_appointments', 'SC2010 do Protheus com app_production_appointments');
                    updated = true;
                }
            }

            if (updated) {
                console.log(`Updating agent "${agent.nome}" (ID: ${agent.id})...`);
                await mysqlPool.query(
                    'UPDATE pcpmetal_agentes SET system_prompt = ?, contexto_negocio = ? WHERE id = ?',
                    [updatedPrompt, updatedContext, agent.id]
                );
            }
        }
        
        console.log('Database update complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
