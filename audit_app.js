const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, 'client', 'src');
const serverDir = path.join(__dirname, 'server');

const allFiles = [];

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else {
            if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
                allFiles.push(fullPath);
            }
        }
    }
}

walkDir(clientDir);
walkDir(serverDir);

const report = [];

// Track all exports and imports to find unused files (crude check)
const fileImports = new Set();
const fileContents = {};

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    fileContents[file] = content;

    // Find imports
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
    const requireRegex = /require\(['"](.*?)['"]\)/g;
    const dynamicImportRegex = /import\(['"](.*?)['"]\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
            const resolvedPath = path.resolve(path.dirname(file), importPath);
            fileImports.add(resolvedPath.toLowerCase());
            fileImports.add(resolvedPath.toLowerCase() + '.js');
            fileImports.add(resolvedPath.toLowerCase() + '.jsx');
        }
    }
    while ((match = requireRegex.exec(content)) !== null) {
        const reqPath = match[1];
        if (reqPath.startsWith('.')) {
            const resolvedPath = path.resolve(path.dirname(file), reqPath);
            fileImports.add(resolvedPath.toLowerCase());
            fileImports.add(resolvedPath.toLowerCase() + '.js');
        }
    }
    while ((match = dynamicImportRegex.exec(content)) !== null) {
        const dynPath = match[1];
        if (dynPath.startsWith('.')) {
            const resolvedPath = path.resolve(path.dirname(file), dynPath);
            fileImports.add(resolvedPath.toLowerCase());
            fileImports.add(resolvedPath.toLowerCase() + '.js');
            fileImports.add(resolvedPath.toLowerCase() + '.jsx');
        }
    }
});

allFiles.forEach(file => {
    const content = fileContents[file];
    const lines = content.split('\n');
    
    let todos = [];
    let commentedBlocks = 0;
    let longComments = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('TODO') || line.includes('FIXME')) {
            todos.push({ line: i + 1, text: line.trim() });
        }
        
        // Crude check for commented out code (// const, // let, // function)
        if (/^\s*\/\/\s*(const|let|var|function|import|export)\s/.test(line)) {
            commentedBlocks++;
        }
    }
    
    const isPotentiallyUnused = !fileImports.has(file.toLowerCase()) && 
                                !file.includes('index.js') && 
                                !file.includes('App.jsx') && 
                                !file.includes('main.jsx') &&
                                !file.includes('server/server.js') &&
                                !file.includes('routes') && // express routes are usually dynamically imported or required
                                !file.includes('cronJobs');
                                
    if (todos.length > 0 || commentedBlocks > 2 || isPotentiallyUnused) {
        report.push({
            file: path.relative(__dirname, file),
            todos: todos.length,
            commentedBlocks,
            isPotentiallyUnused
        });
    }
});

fs.writeFileSync('audit_report.json', JSON.stringify(report, null, 2));
console.log('Audit completed. Found issues in', report.length, 'files.');
