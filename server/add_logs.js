const fs = require('fs');

const filePath = 'c:\\Users\\adm\\Desktop\\MetalFisa Anty\\server\\routes\\production.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the batch plan endpoint
const oldCode = `// POST /api/production/plan-batch - Save Batch Planning (Macro) - OPTIMIZED
router.post('/plan-batch', async (req, res) => {
    try {
        const { plans } = req.body;`;

const newCode = `// POST /api/production/plan-batch - Save Batch Planning (Macro) - OPTIMIZED
router.post('/plan-batch', async (req, res) => {
    console.log('=========== BATCH PLAN ENDPOINT HIT ===========');
    console.log('[BATCH PLAN] Request Body:', JSON.stringify(req.body, null, 2));
    try {
        const { plans } = req.body;
        console.log('[BATCH PLAN] Plans array length:', plans ? plans.length : 0);`;

content = content.replace(oldCode, newCode);

// Also add logging before the database execution
const beforeExec = `                await connection.execute(sql, values);
                console.log(\`   - Saved chunk \${i / CHUNK_SIZE + 1} (\${chunk.length} items)\`);`;

const afterExec = `                console.log('[BATCH PLAN] Executing SQL with', values.length, 'values');
                const [result] = await connection.execute(sql, values);
                console.log(\`   - Saved chunk \${i / CHUNK_SIZE + 1} (\${chunk.length} items) - Affected: \${result.affectedRows}\`);`;

content = content.replace(beforeExec, afterExec);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Logs added successfully');
