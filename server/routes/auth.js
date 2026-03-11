const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in the environment.');
    process.exit(1);
}

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: 3306
};

// Login Route
router.post('/login', async (req, res) => {
    const { login, senha } = req.body;

    if (!login || !senha) {
        return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // Query user from database - PLAIN TEXT PASSWORD as per request
        const [rows] = await connection.execute(
            'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, fotoUsuario FROM usuario WHERE Login = ? AND Senha = ?',
            [login, senha]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = rows[0];

        // Generate Token
        const token = jwt.sign(
            { id: user.idUsuario, login: user.Login, nome: user.NomeCompleto, tipo: user.TipoUsuario },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.idUsuario,
                nome: user.NomeCompleto,
                login: user.Login,
                tipo: user.TipoUsuario,
                fotoUsuario: user.fotoUsuario // Add photo to response
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
        if (connection) await connection.end();
    }
});

// Middleware for protected routes (exporting for use in other files if needed)
const authenticateToken = (req, res, next) => {
    // Bypass auth for document visualization and VMI model download
    if (
        req.originalUrl.startsWith('/api/docs/view') || 
        req.path === '/docs/view' ||
        req.originalUrl.startsWith('/api/vmi/modelo')
    ) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        // Fallback: check query parameter for cases where header cannot be sent
        if (req.query && req.query.token) {
            jwt.verify(req.query.token, SECRET_KEY, (err, user) => {
                if (err) {
                    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
                    return res.status(401).json({ error: 'Sessão inválida', code });
                }
                req.user = user;
                return next();
            });
            return;
        }
        return res.status(401).json({ error: 'Token não fornecido', code: 'TOKEN_MISSING' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
            return res.status(401).json({ error: 'Sessão inválida', code });
        }
        req.user = user;
        next();
    });
};

module.exports = router;
module.exports.authenticateToken = authenticateToken;
