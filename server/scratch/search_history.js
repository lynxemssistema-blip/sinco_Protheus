const fs = require('fs');
const path = require('path');
const historyPath = 'C:/Users/lynx/AppData/Roaming/Code/User/History';
if (!fs.existsSync(historyPath)) { console.log('No history'); process.exit(0); }
const dirs = fs.readdirSync(historyPath);
for (const dir of dirs) {
    const fullDir = path.join(historyPath, dir);
    if (!fs.statSync(fullDir).isDirectory()) continue;
    const files = fs.readdirSync(fullDir);
    for (const file of files) {
        if (file === 'entries.json') continue;
        const full = path.join(fullDir, file);
        try {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes("router.get('/estrutura-pedido', async")) {
                console.log('Found in:', full);
                fs.writeFileSync('c:/Users/lynx/Documents/MetalFisa Anty/server/scratch/backup_pcp.js', content);
                console.log('Saved to backup_pcp.js!');
                process.exit(0);
            }
        } catch(e) {}
    }
}
