const fs = require('fs');
const path = require('path');
const db = require('./services/mysqlService');

async function migrateEverything() {
    try {
        console.log('Iniciando migração completa do helpContent.js para o SGQ Documents...');
        
        // Read helpContent.js
        const filePath = path.join(__dirname, '../client/src/config/helpContent.js');
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

        const keys = Object.keys(HELP_CONTENT);
        console.log(`Encontradas ${keys.length} telas no helpContent.js.`);

        // Get existing documents to check if we already created them
        const [existingDocs] = await db.query('SELECT id, title, code FROM sgq_documents');
        const [processos] = await db.query('SELECT * FROM app_sgq_processos');

        for (let i = 0; i < keys.length; i++) {
            const route = keys[i];
            const data = HELP_CONTENT[route];
            
            let htmlContent = '';
            
            if (data.description) {
                htmlContent += '<h2>Objetivo</h2>';
                htmlContent += '<p>' + data.description + '</p>';
            }

            if (data.tabs && data.tabs.length > 0) {
                htmlContent += '<h2>Abas do Processo</h2>';
                data.tabs.forEach(tab => {
                    htmlContent += '<h3>' + tab.label + '</h3>';
                    if (tab.description) {
                        htmlContent += '<p>' + tab.description + '</p>';
                    }
                    if (tab.steps && tab.steps.length > 0) {
                        htmlContent += '<ul>';
                        tab.steps.forEach(step => {
                            htmlContent += '<li>' + step + '</li>';
                        });
                        htmlContent += '</ul>';
                    }
                });
            }

            if (data.steps && data.steps.length > 0) {
                htmlContent += '<h2>Procedimento Operacional (Como usar)</h2>';
                htmlContent += '<ol>';
                data.steps.forEach(step => {
                    htmlContent += '<li>' + step + '</li>';
                });
                htmlContent += '</ol>';
            }

            if (data.tips && data.tips.length > 0) {
                htmlContent += '<h2>Dicas Pro</h2>';
                data.tips.forEach(tip => {
                    htmlContent += '<blockquote>' + tip + '</blockquote>';
                });
            }

            // Find existing process map
            let p = processos.find(pr => pr.route_path === route);
            
            if (!p) {
                // Needs to insert process
                console.log(`Inserindo novo processo: ${route}`);
                const [insRes] = await db.query(`
                    INSERT INTO app_sgq_processos 
                    (route_path, category, category_color, title, icon, description, steps, tips, links, responsables)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    route, data.category || null, data.categoryColor || null, data.title || null, data.icon || null, 
                    data.description || null, data.steps ? JSON.stringify(data.steps) : '[]', 
                    data.tips ? JSON.stringify(data.tips) : '[]', data.links ? JSON.stringify(data.links) : '[]', '[]'
                ]);
                p = { id: insRes.insertId, route_path: route, document_id: null, category: data.category };
            }

            // Determine sector for document
            let sector = 'Geral';
            if (p.category === 'Comercial') sector = 'Comercial';
            else if (p.category && p.category.includes('Engenharia')) sector = 'Engenharia';
            else if (p.category && p.category.includes('PCP')) sector = 'PCP';
            else if (p.category && p.category.includes('Qualidade')) sector = 'Qualidade';
            else if (p.category === 'Logística') sector = 'Almoxarifado';
            
            let docId = p.document_id;
            
            if (!docId) {
                // Find by title just in case it was created but not linked
                const existingDoc = existingDocs.find(d => d.title === (data.title || 'Documento do Sistema'));
                if (existingDoc) {
                    docId = existingDoc.id;
                } else {
                    // Create new SGQ Document
                    const codeStr = `POP-AJUDA-${(i + 1).toString().padStart(2, '0')}`;
                    const [docIns] = await db.query(`
                    INSERT INTO sgq_documents (code, title, sector, version, content)
                    VALUES (?, ?, ?, ?, ?)
                `, [codeStr, data.title || 'Documento do Sistema', sector, '01', htmlContent]);
                    docId = docIns.insertId;
                }
                
                // Link process to document
                await db.query('UPDATE app_sgq_processos SET document_id = ? WHERE id = ?', [docId, p.id]);
                console.log(`Link criado para ${route} -> Doc ID ${docId}`);
            }

            // Always update document content to ensure it's fully rich and from helpContent
            await db.query('UPDATE sgq_documents SET content = ? WHERE id = ?', [htmlContent, docId]);
            
            // Also update app_sgq_processos title, category, icon, etc in case they were empty
            await db.query(`
                UPDATE app_sgq_processos SET 
                title = ?, category = ?, icon = ?, category_color = ?, description = ?
                WHERE id = ?
            `, [data.title, data.category, data.icon, data.categoryColor, data.description, p.id]);
        }
        
        console.log('Migração 100% finalizada com todos os conteúdos ricos (incluindo abas)!');
        process.exit(0);

    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

migrateEverything();
