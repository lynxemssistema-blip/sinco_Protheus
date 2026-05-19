const fs = require('fs');
const path = require('path');
const db = require('../services/mysqlService');

async function migrate() {
    try {
        console.log('Dropando e recriando tabela app_sgq_processos no MySQL com UTF8MB4...');
        await db.query(`DROP TABLE IF EXISTS app_sgq_processos`);
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_sgq_processos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                route_path VARCHAR(191) UNIQUE NOT NULL,
                category VARCHAR(100),
                category_color VARCHAR(50),
                title VARCHAR(150),
                icon VARCHAR(100),
                description TEXT,
                steps TEXT,
                tips TEXT,
                links TEXT,
                responsables TEXT,
                document_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('Tabela verificada. Lendo helpContent.js...');
        const filePath = path.join(__dirname, '../../client/src/config/helpContent.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        const lines = fileContent.split('\n');
        let inObject = false;
        let objectString = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('export const HELP_CONTENT = {')) {
                inObject = true;
                objectString += '{\n';
                continue;
            }
            if (inObject) {
                if (lines[i].includes('export function') || lines[i].startsWith('export ')) {
                    break;
                }
                objectString += lines[i] + '\n';
            }
        }
        
        objectString = objectString.trim().replace(/;$/, '');

        let HELP_CONTENT;
        try {
            eval(`HELP_CONTENT = ${objectString}`);
        } catch(e) {
            console.log("Erro no parser da ajuda JS:", e);
            throw e;
        }

        console.log(`Encontradas ${Object.keys(HELP_CONTENT).length} telas. Inserindo no Banco MySQL...`);
        
        await db.query(`TRUNCATE TABLE app_sgq_processos`);

        for (const [route, data] of Object.entries(HELP_CONTENT)) {
            const row = {
                route_path: route,
                category: data.category || null,
                category_color: data.categoryColor || null,
                title: data.title || null,
                icon: data.icon || null,
                description: data.description || null,
                steps: data.steps ? JSON.stringify(data.steps) : '[]',
                tips: data.tips ? JSON.stringify(data.tips) : '[]',
                links: data.links ? JSON.stringify(data.links) : '[]',
                responsables: JSON.stringify([]) 
            };

            await db.query(`
                INSERT INTO app_sgq_processos 
                (route_path, category, category_color, title, icon, description, steps, tips, links, responsables)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                category = VALUES(category),
                category_color = VALUES(category_color),
                title = VALUES(title),
                icon = VALUES(icon),
                description = VALUES(description),
                steps = VALUES(steps),
                tips = VALUES(tips),
                links = VALUES(links)
            `, [
                row.route_path, row.category, row.category_color, row.title, row.icon, 
                row.description, row.steps, row.tips, row.links, row.responsables
            ]);
        }
        
        console.log('SGQ Seed Migração concluída com sucesso!');
        process.exit(0);

    } catch (err) {
        console.error('Erro geral:', err);
        process.exit(1);
    }
}

migrate();
