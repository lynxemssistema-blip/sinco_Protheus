const { NodeSSH } = require('node-ssh');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ssh = new NodeSSH();

async function deployHostinger() {
    const tarFile = path.join(__dirname, 'hostinger-deploy.tar.gz');
    const privateKey = 'C:/Users/lynx/.ssh/id_hostinger_lynx';

    try {
        console.log('====================================================');
        console.log('  🚀 PUBLICAÇÃO OFICIAL NA HOSTINGER (https://lynxems.com.br)');
        console.log('====================================================\n');

        // 1. Empacotar arquivos de producao-hostinger
        console.log('📦 [1/5] Empacotando arquivos de produção em tar.gz...');
        if (fs.existsSync(tarFile)) {
            fs.unlinkSync(tarFile);
        }
        
        // Compacta producao-hostinger preservando .env remoto
        execSync(
            'tar --exclude="server/.env" --exclude="*.log" --exclude="node_modules" -czf hostinger-deploy.tar.gz -C producao-hostinger .',
            { stdio: 'inherit', cwd: __dirname }
        );
        const stats = fs.statSync(tarFile);
        console.log(`✅ Pacote gerado com ${(stats.size / (1024 * 1024)).toFixed(2)} MB.\n`);

        // 2. Conectar via SSH na Hostinger
        console.log('🔗 [2/5] Conectando ao servidor Hostinger (193.203.175.68:65002)...');
        await ssh.connect({
            host: '193.203.175.68',
            port: 65002,
            username: 'u494795077',
            privateKeyPath: privateKey,
            readyTimeout: 30000
        });
        console.log('✅ Conexão SSH autenticada com sucesso!\n');

        // 3. Enviar pacote tar.gz
        console.log('📤 [3/5] Enviando pacote para /home/u494795077/hostinger-deploy.tar.gz...');
        await ssh.putFile(tarFile, '/home/u494795077/hostinger-deploy.tar.gz');
        console.log('✅ Upload concluído com sucesso.\n');

        // 4. Extrair e reiniciar no servidor
        console.log('⚙️ [4/5] Extraindo arquivos na public_html e reiniciando LiteSpeed/Node.js...');
        const remoteCmd = [
            'cd /home/u494795077/domains/lynxems.com.br/public_html',
            'cp index.html index.html.bak 2>/dev/null || true',
            'tar -xzf /home/u494795077/hostinger-deploy.tar.gz',
            'chmod -R 755 .',
            'mkdir -p tmp',
            'touch tmp/restart.txt',
            'rm -f /home/u494795077/hostinger-deploy.tar.gz'
        ].join(' && ');

        const result = await ssh.execCommand(remoteCmd);
        if (result.stdout) console.log('STDOUT:\n' + result.stdout);
        if (result.stderr) console.log('STDERR:\n' + result.stderr);
        console.log('✅ Aplicação extraída e reinício acionado via tmp/restart.txt.\n');

        ssh.dispose();

        // 5. Limpeza local e teste de status
        if (fs.existsSync(tarFile)) {
            fs.unlinkSync(tarFile);
        }

        console.log('🌐 [5/5] Testando disponibilidade em produção...');
        
        // Aguarda 3 segundos para propagação do LiteSpeed
        await new Promise(res => setTimeout(res, 3000));

        const [rHome, rPdf, rPptx] = await Promise.all([
            fetch('https://lynxems.com.br').then(r => r.status).catch(e => e.message),
            fetch('https://lynxems.com.br/SINCO_Apresentacao_Executiva_Lynx_SIM.pdf', { method: 'HEAD' }).then(r => ({ status: r.status, size: r.headers.get('content-length') })).catch(e => ({ error: e.message })),
            fetch('https://lynxems.com.br/SINCO_Apresentacao_Executiva_Lynx_SIM.pptx', { method: 'HEAD' }).then(r => ({ status: r.status, size: r.headers.get('content-length') })).catch(e => ({ error: e.message }))
        ]);

        console.log(`\n====================================================`);
        console.log(`  🎉 PUBLICAÇÃO HOSTINGER CONCLUÍDA COM SUCESSO!`);
        console.log(`====================================================`);
        console.log(`  🌐 Home Portal: https://lynxems.com.br (HTTP ${rHome})`);
        console.log(`  📄 Apresentação PDF: https://lynxems.com.br/SINCO_Apresentacao_Executiva_Lynx_SIM.pdf (HTTP ${rPdf.status}, ${rPdf.size} bytes)`);
        console.log(`  📊 Apresentação PPTX: https://lynxems.com.br/SINCO_Apresentacao_Executiva_Lynx_SIM.pptx (HTTP ${rPptx.status}, ${rPptx.size} bytes)`);
        console.log(`====================================================\n`);

    } catch (err) {
        console.error('❌ Falha na publicação Hostinger:', err);
        if (fs.existsSync(tarFile)) {
            fs.unlinkSync(tarFile);
        }
        process.exit(1);
    }
}

deployHostinger();
