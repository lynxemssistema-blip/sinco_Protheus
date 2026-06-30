const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
    try {
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1401',
            port: 22
        });
        console.log('CONNECTED');

        console.log('--- nginx status & config check ---');
        const resNginx = await ssh.execCommand('sudo systemctl status nginx || service nginx status');
        console.log(resNginx.stdout || resNginx.stderr);

        console.log('--- nginx configurations in sites-enabled ---');
        const resConf = await ssh.execCommand('ls -la /etc/nginx/sites-enabled/');
        console.log(resConf.stdout || resConf.stderr);

        console.log('--- cat active nginx config ---');
        const resCat = await ssh.execCommand('cat /etc/nginx/sites-enabled/default || cat /etc/nginx/sites-enabled/metalfisa || cat /etc/nginx/nginx.conf');
        console.log(resCat.stdout || resCat.stderr);

        console.log('--- remote folder check ---');
        const resDir = await ssh.execCommand('ls -la /var/www/metalfisa/client/dist /var/www/metalfisa/client');
        console.log(resDir.stdout || resDir.stderr);

        console.log('--- nginx processes ---');
        const resPs = await ssh.execCommand('ps aux | grep nginx');
        console.log(resPs.stdout || resPs.stderr);

        console.log('--- test read index.html as www-data or nginx ---');
        const resReadW = await ssh.execCommand('sudo -u www-data cat /var/www/metalfisa/client/dist/index.html');
        console.log('Read by www-data:', resReadW.stdout || resReadW.stderr);
        const resReadN = await ssh.execCommand('sudo -u nginx cat /var/www/metalfisa/client/dist/index.html');
        console.log('Read by nginx:', resReadN.stdout || resReadN.stderr);

        ssh.dispose();
    } catch (err) {
        console.error('ERROR:', err);
    }
}
run();
