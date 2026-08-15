const fs = require('fs');

const transcript = fs.readFileSync('C:/Users/lynx/.gemini/antigravity-ide/brain/686e2433-54f0-4cc0-8fa8-a77e851947f6/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = transcript.split('\n').filter(Boolean);
for (const line of lines) {
    try {
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes("router.get('/estrutura-pedido', async") && obj.content.includes("File Path: `file:///c:/Users/lynx/Documents/MetalFisa%20Anty/server/routes/pcpRefinado.js`")) {
            fs.writeFileSync('c:/Users/lynx/Documents/MetalFisa Anty/server/scratch/extracted_pcp2.txt', obj.content);
            console.log('Found full file from view_file!');
            process.exit(0);
        }
    } catch(e) {}
}
console.log('Not found');
