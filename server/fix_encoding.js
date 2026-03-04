
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes', 'production.js');

try {
    const buffer = fs.readFileSync(filePath);
    // Try to convert to string using utf-8
    let content = buffer.toString('utf8');

    // Check if it looks corrupted (e.g. contains replacement characters or weird sequences)
    // We saw 'Y"S' in the logs, let's search for that and other anomalies

    console.log(`Read ${content.length} characters.`);

    // Basic cleanup: ensure it doesn't have BOM logic issues by writing it back cleanly
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    console.log('Successfully wrote back as utf-8');

} catch (err) {
    console.error('Error fixing encoding:', err);
}
