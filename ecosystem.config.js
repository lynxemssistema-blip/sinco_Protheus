module.exports = {
    apps: [
        {
            name: 'print-bridge',
            script: 'print-bridge.js',
            cwd: '.',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                PRINTER_NAME: 'ArgoxUSB'
            }
        },
        {
            name: 'metalfisa-backend',
            script: 'index.js',
            cwd: './server',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3001
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G'
        }
    ]
};
