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
                const originalPrompt = updatedPrompt;
                updatedPrompt = updatedPrompt.replace(/FCS/g, 'PCF');
                updatedPrompt = updatedPrompt.replace(/Finite Capacity Scheduling/g, 'Programação de Capacidade Finita');
                if (updatedPrompt !== originalPrompt) {
                    updated = true;
                }
            }

            if (updatedContext) {
                const originalContext = updatedContext;
                updatedContext = updatedContext.replace(/FCS/g, 'PCF');
                updatedContext = updatedContext.replace(/Finite Capacity Scheduling/g, 'Programação de Capacidade Finita');
                if (updatedContext !== originalContext) {
                    updated = true;
                }
            }

            if (updated) {
                console.log(`Updating agent "${agent.nome}" (ID: ${agent.id}) to use PCF...`);
                await mysqlPool.query(
                    'UPDATE pcpmetal_agentes SET system_prompt = ?, contexto_negocio = ? WHERE id = ?',
                    [updatedPrompt, updatedContext, agent.id]
                );
            }
        }
        
        console.log('Database agents update complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
