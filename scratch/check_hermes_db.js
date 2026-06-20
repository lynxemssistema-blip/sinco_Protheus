const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkHermesDB() {
    console.log('--- Checking Hermes Tables and Data ---');
    try {
        // 1. Check hermes_config
        const [configTables] = await mysqlPool.query("SHOW TABLES LIKE 'hermes_config'");
        if (configTables.length > 0) {
            console.log('✅ Table hermes_config exists.');
            const [configs] = await mysqlPool.query("SELECT * FROM hermes_config");
            console.log('Configs:', configs);
        } else {
            console.log('❌ Table hermes_config DOES NOT exist.');
        }

        // 2. Check hermes_chat_memory
        const [memoryTables] = await mysqlPool.query("SHOW TABLES LIKE 'hermes_chat_memory'");
        if (memoryTables.length > 0) {
            console.log('✅ Table hermes_chat_memory exists.');
            const [count] = await mysqlPool.query("SELECT COUNT(*) as count FROM hermes_chat_memory");
            console.log('Chat Memory count:', count[0].count);
        } else {
            console.log('❌ Table hermes_chat_memory DOES NOT exist.');
        }

        // 3. Check hermes_tasks
        const [tasksTables] = await mysqlPool.query("SHOW TABLES LIKE 'hermes_tasks'");
        if (tasksTables.length > 0) {
            console.log('✅ Table hermes_tasks exists.');
            const [tasks] = await mysqlPool.query("SELECT id, nome, ativo, cron_expression, last_run, status_last_run FROM hermes_tasks");
            console.log('Tasks:', tasks);
        } else {
            console.log('❌ Table hermes_tasks DOES NOT exist.');
        }

    } catch (err) {
        console.error('Error checking Hermes DB:', err);
    } finally {
        process.exit(0);
    }
}

checkHermesDB();
