module.exports = {
    apps: [
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
