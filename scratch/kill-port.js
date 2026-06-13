const { execSync } = require('child_process');

try {
    console.log('Buscando processo na porta 3002...');
    const output = execSync('netstat -ano | findstr :3002', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    const pids = new Set();
    
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid) && pid !== '0') {
                pids.add(pid);
            }
        }
    }
    
    if (pids.size === 0) {
        console.log('Nenhum processo ativo encontrado na porta 3002.');
    } else {
        for (const pid of pids) {
            console.log(`Matando processo PID ${pid}...`);
            try {
                execSync(`taskkill /F /PID ${pid}`);
                console.log(`Processo ${pid} finalizado.`);
            } catch (err) {
                console.warn(`Erro ao finalizar processo ${pid}:`, err.message);
            }
        }
    }
} catch (error) {
    console.log('Nenhuma conexão encontrada ou erro ao executar netstat:', error.message);
}
