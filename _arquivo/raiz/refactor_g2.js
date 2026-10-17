const fs = require('fs');
const path = require('path');

const files = [
    'routes/production.js',
    'routes/producao.js',
    'routes/materials.js',
    'routes/pedidos.js',
    'routes/produtos.js',
    'routes/vmi.js',
    'routes/production_tracking_comparison.js',
    'comparison_endpoint_v2.js',
    'comparison_endpoint_fixed.js'
];

let changedFiles = 0;

for (let file of files) {
    const fullPath = path.join(__dirname, 'server', file);
    if (!fs.existsSync(fullPath)) {
        console.log('Skipping', fullPath);
        continue;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (!content.includes('g2_descri')) {
        console.log('No g2_descri in', file);
        continue;
    }
    
    // Replace g2_descri variations directly
    content = content.replace(/g2\.g2_descri/g, 'h1.h1_descri');
    content = content.replace(/sg2\.g2_descri/g, 'h1.h1_descri');
    content = content.replace(/dp\.g2_descri/g, 'h1.h1_descri');
    
    // Replace bare g2_descri not preceded by dot
    content = content.replace(/(?<!\.)g2_descri/g, 'h1_descri');
    
    // Replace h1.h1_descri into h1_descri if it was bare before? The above leaves it as h1_descri.

    // Inject LEFT JOIN public.sh1010 h1 ... after public.sg2010 joins
    content = content.replace(/(LEFT JOIN public\.sg(?:1|2)010 [a-zA-Z0-9_]+[ ]+ON[^\n]*(?:\n[ \t]+AND COALESCE\([^\n]*\))?)/g, (match) => {
        // Find alias used for sg2010
        const aliasMatch = match.match(/public\.sg(?:1|2)010 ([a-zA-Z0-9_]+)/);
        const alias = aliasMatch ? aliasMatch[1] : 'g2';
        
        return match + '\n            LEFT JOIN public.sh1010 h1 ON h1.h1_codigo = ' + alias + '.g2_recurso AND COALESCE(h1.d_e_l_e_t_, \'\') IN (\'\', \' \')';
    });

    // Cleanup double sh1010 joins if any exist due to our brute force or existing code
    content = content.replace(/(LEFT JOIN public\.sh1010 h1 ON [^\n]*(?:\n[ \t]+AND COALESCE\([^\n]*\))?)[ \t]*\n[ \t]+LEFT JOIN public\.sh1010 h1 ON [^\n]+/g, '$1');

    // Also handle replacing references to g2_descri inside functions
    // e.g., TRIM(g2_descri) is now TRIM(h1_descri)

    fs.writeFileSync(fullPath, content);
    console.log('Updated', file);
    changedFiles++;
}
console.log('Total files updated:', changedFiles);
