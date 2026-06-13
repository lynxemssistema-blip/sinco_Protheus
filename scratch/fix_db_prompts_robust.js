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
                // Replace any occurrence of SC9010/sc9010 referring to OP
                updatedPrompt = updatedPrompt.replace(/`?sc9010`?\s*\(cabeçalho da op\)/gi, '`SC2010` (cabeçalho da OP)');
                updatedPrompt = updatedPrompt.replace(/`?sc9010`?\s*do protheus com/gi, '`SC2010` do Protheus com');
                
                if (updatedPrompt !== originalPrompt) {
                    updated = true;
                }
            }

            if (updatedContext) {
                const originalContext = updatedContext;
                updatedContext = updatedContext.replace(/`?sc9010`?\s*\(cabeçalho da op\)/gi, '`SC2010` (cabeçalho da OP)');
                updatedContext = updatedContext.replace(/`?sc9010`?\s*do protheus com/gi, '`SC2010` do Protheus com');
                
                if (updatedContext !== originalContext) {
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
