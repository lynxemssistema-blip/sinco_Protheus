const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function test() {
    try {
        console.log('Connecting...');
        await ssh.connect({
            host: '192.168.1.77',
            username: 'sinco',
            password: 'Metal1405',
            port: 22,
            algorithms: {
                serverHostKey: [
                    'ssh-rsa',
                    'ssh-dss',
                    'ssh-ed25519',
                    'ecdsa-sha2-nistp256',
                    'ecdsa-sha2-nistp384',
                    'ecdsa-sha2-nistp521'
                ]
            }
        });
        console.log("SUCCESS!");
        process.exit(0);
    } catch(err) {
        console.error("FAIL", err);
        process.exit(1);
    }
}
test();
