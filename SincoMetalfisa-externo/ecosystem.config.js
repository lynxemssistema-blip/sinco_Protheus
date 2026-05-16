module.exports = {
    apps: [
        {
            name: 'metalfisa-backend-externo',
            script: 'index.js',
            cwd: './server',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3003
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G'
        }
    ]
};
