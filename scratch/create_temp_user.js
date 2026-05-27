require('dotenv').config({ path: 'server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function createTempUser() {
    try {
        const login = 'test_antigravity';
        const senha = 'password123';
        const nome = 'Antigravity Test User';
        const email = 'antigravity@test.com';
        const tipo = 'A';
        const aprovado = 1;

        // Delete if already exists
        await mysqlPool.query('DELETE FROM usuario WHERE Login = ?', [login]);

        // Insert new user
        const [result] = await mysqlPool.query(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, email, TipoUsuario, aprovado) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, login, senha, email, tipo, aprovado]
        );
        console.log('✅ Temporary user created successfully:', result);
    } catch (err) {
        console.error('Error creating user:', err);
    }
    process.exit();
}

createTempUser();
