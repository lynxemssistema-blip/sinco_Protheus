const { execSync } = require('child_process');

try {
    const output = execSync('netstat -ano').toString();
    const lines = output.split('\n');
    let found = false;
    for (const line of lines) {
        if (line.includes(':3002') && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            console.log(`Found process listening on port 3002 with PID: ${pid}`);
            console.log(`Killing process ${pid}...`);
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`Process ${pid} killed successfully.`);
            found = true;
        }
    }
    if (!found) {
        console.log('No process found listening on port 3002.');
    }
} catch (e) {
    console.error('Error finding/killing process on port 3002:', e.message);
}
