const fs = require('fs');

const raw = fs.readFileSync('c:/Users/lynx/Documents/MetalFisa Anty/server/scratch/extracted_pcp2.txt', 'utf8');
const lines = raw.split('\n');

let isCode = false;
const cleanLines = [];
for (const line of lines) {
    if (line.includes('The following code has been modified to include a line number before every line')) {
        isCode = true;
        continue;
    }
    if (line.includes('The above content shows the entire, complete file contents') || line.includes('The above content shows a truncated version')) {
        isCode = false;
        break;
    }
    if (isCode) {
        // match "1900: "
        const match = line.match(/^\d+:\s?(.*)/);
        if (match) {
            cleanLines.push(match[1]);
        } else {
            cleanLines.push(line);
        }
    }
}

fs.writeFileSync('c:/Users/lynx/Documents/MetalFisa Anty/server/scratch/clean_route.js', cleanLines.join('\n'));
console.log('Extracted route to clean_route.js!');
